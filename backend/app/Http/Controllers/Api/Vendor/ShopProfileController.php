<?php

namespace App\Http\Controllers\Api\Vendor;

use App\Http\Controllers\Controller;
use App\Http\Requests\Vendor\UpdateShopBrandingRequest;
use App\Http\Requests\Vendor\UpdateShopProfileRequest;
use App\Models\RentalShop;
use App\Models\ShopSettings;
use App\Services\AuditService;
use App\Services\RentalAgreementService;
use App\Support\VendorContext;
use App\Traits\JsonResponse as JsonResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

/** The active shop's own public-facing profile — RentalShop has no BelongsToShop (it IS the shop), so it's resolved explicitly from VendorContext. */
class ShopProfileController extends Controller
{
    use JsonResponseTrait;

    public function __construct()
    {
        $this->middleware('can:vendor-settings-shop-view')->only('show');
        $this->middleware('can:vendor-settings-shop-edit')->only(['update', 'updateBranding']);
        $this->middleware('can:vendor-settings-terms-view')->only('terms');
        $this->middleware('can:vendor-settings-terms-edit')->only('updateTerms');
    }

    public function show(): JsonResponse
    {
        $shop = RentalShop::findOrFail(VendorContext::shopId());

        return $this->response('Shop profile retrieved', $shop);
    }

    public function update(UpdateShopProfileRequest $request): JsonResponse
    {
        $shop = RentalShop::findOrFail(VendorContext::shopId());
        $old = $shop->only($shop->getFillable());

        $shop->update($request->validated());

        AuditService::edit('RentalShop', $shop->id, $shop->name, $old, $shop->only($shop->getFillable()));

        return $this->response('Shop profile updated', $shop->fresh());
    }

    /**
     * Logo and cover banner - multipart, so kept apart from the JSON
     * update() above. Each image is replaced (old file deleted) or cleared
     * via remove_logo / remove_cover_image.
     */
    public function updateBranding(UpdateShopBrandingRequest $request): JsonResponse
    {
        $shop = RentalShop::findOrFail(VendorContext::shopId());
        $old = $shop->only(['logo', 'cover_image']);
        $data = [];

        foreach (['logo' => 'shop-logos', 'cover_image' => 'shop-covers'] as $field => $dir) {
            if (!$request->hasFile($field) && !$request->boolean("remove_{$field}")) {
                continue;
            }

            if ($shop->{$field} && !str_starts_with($shop->{$field}, 'http')) {
                Storage::disk('public')->delete($shop->{$field});
            }

            $data[$field] = $request->hasFile($field) ? $request->file($field)->store($dir, 'public') : null;
        }

        $shop->update($data);

        AuditService::edit('RentalShop', $shop->id, $shop->name, $old, $shop->only(['logo', 'cover_image']));

        return $this->response('Shop branding updated', $shop->fresh());
    }

    /** The shop's own terms & conditions — the customer agrees to and signs them at handover. */
    public function terms(): JsonResponse
    {
        return $this->response('Terms retrieved', [
            'terms' => (string) app(RentalAgreementService::class)->termsFor(VendorContext::shopId()),
        ]);
    }

    public function updateTerms(Request $request): JsonResponse
    {
        $terms = $request->validate(['terms' => ['nullable', 'string', 'max:20000']])['terms'] ?? null;
        $settings = ShopSettings::where('shop_id', VendorContext::shopId())->first() ?? ShopSettings::createFor(VendorContext::shopId());
        $settings->update(['agreement_terms' => app(RentalAgreementService::class)->sanitize($terms)]);
        AuditService::edit('ShopSettings', $settings->id, 'Terms & conditions', null, ['agreement_terms' => 'updated']);

        return $this->response('Terms & conditions saved', ['terms' => (string) $settings->agreement_terms]);
    }
}
