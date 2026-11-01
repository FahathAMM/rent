<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Onboarding\RegisterShopRequest;
use App\Http\Requests\Onboarding\UploadShopDocumentRequest;
use App\Models\Attachment;
use App\Models\RentalShop;
use App\Models\ShopVerification;
use App\Services\AuditService;
use App\Services\AuthUser;
use App\Services\ShopOnboardingService;
use App\Traits\JsonResponse as JsonResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Business shop registration. Deliberately does NOT require shop.context
 * (there is no shop yet for store()) - a shop the caller already owns is
 * looked up and ownership-checked explicitly instead of relying on
 * ShopScope, which only applies once a shop context is resolved.
 */
class ShopOnboardingController extends Controller
{
    use JsonResponseTrait;

    public function __construct(private ShopOnboardingService $service) {}

    /** The caller's shop (of any status), as a list — not shop-scoped, this IS the shop-discovery endpoint. */
    public function index(): JsonResponse
    {
        $shops = RentalShop::query()
            ->whereHas('members', fn ($q) => $q->whereKey(AuthUser::id()))
            ->with('verifications.attachment')
            ->get();

        return $this->response('Shops retrieved', $shops);
    }

    public function store(RegisterShopRequest $request): JsonResponse
    {
        $shop = $this->service->register(AuthUser::user(), $request->validated());

        AuditService::create('RentalShop', $shop->id, $shop->name);

        return $this->response('Shop registered — pending verification', $shop, 201);
    }

    public function uploadDocument(UploadShopDocumentRequest $request, int $shop): JsonResponse
    {
        $shopModel = RentalShop::query()
            ->where('id', $shop)
            ->where('owner_user_id', AuthUser::id())
            ->firstOrFail();

        $file = $request->file('file');
        $path = $file->store("verifications/shop/{$shopModel->id}", 'local');

        $attachment = Attachment::create([
            'shop_id' => $shopModel->id,
            'uploaded_by' => AuthUser::id(),
            'file_name' => $file->getClientOriginalName(),
            'file_path' => $path,
            'disk' => 'local',
            'mime_type' => $file->getClientMimeType(),
            'file_size' => $file->getSize(),
            'attachable_type' => 'rental_shop',
            'attachable_id' => $shopModel->id,
            'document_type' => $request->validated('document_type'),
            'visibility' => Attachment::VISIBILITY_PRIVATE,
        ]);

        $verification = ShopVerification::updateOrCreate(
            ['shop_id' => $shopModel->id, 'document_type' => $request->validated('document_type')],
            ['attachment_id' => $attachment->id, 'status' => 'pending', 'reviewed_by' => null, 'reviewed_at' => null, 'rejection_reason' => null]
        );

        return $this->response('Document uploaded', $verification->load('attachment'), 201);
    }

    public function submitForVerification(int $shop): JsonResponse
    {
        $shopModel = RentalShop::query()
            ->where('id', $shop)
            ->where('owner_user_id', AuthUser::id())
            ->firstOrFail();

        $shopModel = $this->service->submitForVerification($shopModel);

        return $this->response('Shop submitted for verification', $shopModel);
    }

    /** The shop's owner (or a member allowed to see the shop profile) viewing its own uploaded document — never another shop's. */
    public function downloadDocument(ShopVerification $verification): StreamedResponse
    {
        $shop = $verification->shop;
        $user = AuthUser::user();
        $allowed = (int) $shop->owner_user_id === $user->id
            || ((int) $user->shop_id === $shop->id && $user->hasVendorPermission('vendor-settings-shop-view'));
        abort_unless($allowed, 403);

        $attachment = $verification->attachment;
        abort_unless(Storage::disk($attachment->disk)->exists($attachment->file_path), 404);

        AuditService::view('ShopVerification', $verification->id, $attachment->file_name);

        return Storage::disk($attachment->disk)->download($attachment->file_path, $attachment->file_name);
    }
}
