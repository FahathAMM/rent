<?php

namespace App\Http\Controllers\Api\Platform;

use App\Http\Controllers\Controller;
use App\Http\Requests\Platform\ReasonRequest;
use App\Models\OwnerProfile;
use App\Models\OwnerVerification;
use App\Models\SystemAdmin;
use App\Services\AuditService;
use App\Services\OwnerOnboardingService;
use App\Traits\JsonResponse as JsonResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class OwnerVerificationController extends Controller
{
    use JsonResponseTrait;

    public function __construct(private OwnerOnboardingService $service) {}

    public function index(Request $request): JsonResponse
    {
        $applications = OwnerProfile::with('user:id,name,email')
            ->when($request->status, fn ($q) => $q->where('status', $request->status))
            ->when($request->search, fn ($q) => $q->where('full_name', 'like', "%{$request->search}%"))
            ->orderByDesc('submitted_at')
            ->paginate(min((int) $request->get('perPage', 20), 100));

        return response()->json(['record' => $applications, 'message' => 'Applications retrieved', 'status' => true]);
    }

    public function show(OwnerProfile $ownerProfile): JsonResponse
    {
        $ownerProfile->load('user:id,name,email', 'verifications.attachment');

        return $this->response('Application retrieved', $ownerProfile);
    }

    public function approve(OwnerProfile $ownerProfile): JsonResponse
    {
        $profile = $this->service->approve($this->admin(), $ownerProfile);

        return $this->response('Owner application approved', $profile);
    }

    public function reject(ReasonRequest $request, OwnerProfile $ownerProfile): JsonResponse
    {
        $profile = $this->service->reject($this->admin(), $ownerProfile, $request->validated('reason'));

        return $this->response('Owner application rejected', $profile);
    }

    public function requestInfo(ReasonRequest $request, OwnerProfile $ownerProfile): JsonResponse
    {
        $profile = $this->service->requestInfo($this->admin(), $ownerProfile, $request->validated('reason'));

        return $this->response('More information requested', $profile);
    }

    public function suspend(ReasonRequest $request, OwnerProfile $ownerProfile): JsonResponse
    {
        $profile = $this->service->suspend($this->admin(), $ownerProfile, $request->validated('reason'));

        return $this->response('Owner suspended', $profile);
    }

    /** A platform admin reviewing a submitted document — every access audited (see AuditService::view()). */
    public function downloadDocument(OwnerVerification $verification): StreamedResponse
    {
        $attachment = $verification->attachment;
        abort_unless(Storage::disk($attachment->disk)->exists($attachment->file_path), 404);

        AuditService::view('OwnerVerification', $verification->id, $attachment->file_name);

        return Storage::disk($attachment->disk)->download($attachment->file_path, $attachment->file_name);
    }

    private function admin(): SystemAdmin
    {
        /** @var SystemAdmin $admin */
        $admin = auth('platform')->user();

        return $admin;
    }
}
