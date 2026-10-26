<?php

namespace App\Http\Controllers\Api\Vendor;

use App\Http\Controllers\Controller;
use App\Http\Requests\Vendor\UpdateShopProfileRequest;
use App\Models\RentalShop;
use App\Services\AuditService;
use App\Support\VendorContext;
use App\Traits\JsonResponse as JsonResponseTrait;
use Illuminate\Http\JsonResponse;

/** The active shop's own public-facing profile — RentalShop has no BelongsToShop (it IS the shop), so it's resolved explicitly from VendorContext. */
class ShopProfileController extends Controller
{
    use JsonResponseTrait;

    public function __construct()
    {
        $this->middleware('can:vendor-settings-shop-view')->only('show');
        $this->middleware('can:vendor-settings-shop-edit')->only('update');
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
}
