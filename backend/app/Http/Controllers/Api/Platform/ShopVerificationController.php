<?php

namespace App\Http\Controllers\Api\Platform;

use App\Http\Controllers\Controller;
use App\Http\Requests\Platform\ReasonRequest;
use App\Models\RentalShop;
use App\Models\ShopVerification;
use App\Models\SystemAdmin;
use App\Services\AuditService;
use App\Services\ShopOnboardingService;
use App\Traits\JsonResponse as JsonResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ShopVerificationController extends Controller
{
    use JsonResponseTrait;

    public function __construct(private ShopOnboardingService $service) {}

    public function index(Request $request): JsonResponse
    {
        $shops = RentalShop::with('owner:id,name,email')
            ->when($request->status, fn ($q) => $q->where('status', $request->status))
            ->when($request->verification_status, fn ($q) => $q->where('verification_status', $request->verification_status))
            ->when($request->search, fn ($q) => $q->where('name', 'like', "%{$request->search}%"))
            ->orderByDesc('created_at')
            ->paginate(min((int) $request->get('perPage', 20), 100));

        return response()->json(['record' => $shops, 'message' => 'Shops retrieved', 'status' => true]);
    }

    public function show(RentalShop $rentalShop): JsonResponse
    {
        $rentalShop->load('owner:id,name,email', 'verifications.attachment', 'members.user:id,name,email');

        return $this->response('Shop retrieved', $rentalShop);
    }

    public function verify(RentalShop $rentalShop): JsonResponse
    {
        $shop = $this->service->verify($this->admin(), $rentalShop);

        return $this->response('Shop verified and published', $shop);
    }

    public function reject(ReasonRequest $request, RentalShop $rentalShop): JsonResponse
    {
        $shop = $this->service->reject($this->admin(), $rentalShop, $request->validated('reason'));

        return $this->response('Shop rejected', $shop);
    }

    public function suspend(ReasonRequest $request, RentalShop $rentalShop): JsonResponse
    {
        $shop = $this->service->suspend($this->admin(), $rentalShop, $request->validated('reason'));

        return $this->response('Shop suspended', $shop);
    }

    public function activate(RentalShop $rentalShop): JsonResponse
    {
        $shop = $this->service->activate($this->admin(), $rentalShop);

        return $this->response('Shop activated', $shop);
    }

    /** A platform admin reviewing a submitted document — every access audited (see AuditService::view()). */
    public function downloadDocument(ShopVerification $verification): StreamedResponse
    {
        $attachment = $verification->attachment;
        abort_unless(Storage::disk($attachment->disk)->exists($attachment->file_path), 404);

        AuditService::view('ShopVerification', $verification->id, $attachment->file_name);

        return Storage::disk($attachment->disk)->download($attachment->file_path, $attachment->file_name);
    }

    private function admin(): SystemAdmin
    {
        /** @var SystemAdmin $admin */
        $admin = auth('platform')->user();

        return $admin;
    }
}
