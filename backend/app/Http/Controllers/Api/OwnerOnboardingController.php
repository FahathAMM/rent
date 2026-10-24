<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Onboarding\SaveOwnerProfileRequest;
use App\Http\Requests\Onboarding\UploadOwnerDocumentRequest;
use App\Models\Attachment;
use App\Models\OwnerProfile;
use App\Models\OwnerVerification;
use App\Services\AuditService;
use App\Services\AuthUser;
use App\Services\OwnerOnboardingService;
use App\Traits\JsonResponse as JsonResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * The individual-owner application flow - no shop context involved at
 * all (there is no shop until approval auto-provisions one). Every
 * action here operates on the authenticated user's own OwnerProfile;
 * there is exactly one per user (unique user_id).
 */
class OwnerOnboardingController extends Controller
{
    use JsonResponseTrait;

    public function __construct(private OwnerOnboardingService $service) {}

    public function show(): JsonResponse
    {
        $profile = OwnerProfile::where('user_id', AuthUser::id())
            ->with('verifications.attachment')
            ->first();

        return $this->response('Owner application retrieved', $profile);
    }

    public function store(SaveOwnerProfileRequest $request): JsonResponse
    {
        $data = $request->validated();
        $termsAccepted = (bool) ($data['terms_accepted'] ?? false);
        unset($data['terms_accepted']);
        if ($termsAccepted) {
            $data['terms_accepted_at'] = now();
        }

        $profile = $this->service->saveDraft(AuthUser::user(), $data);

        return $this->response('Application saved', $profile);
    }

    public function uploadDocument(UploadOwnerDocumentRequest $request): JsonResponse
    {
        $profile = OwnerProfile::where('user_id', AuthUser::id())->firstOrFail();

        $file = $request->file('file');
        $path = $file->store("verifications/owner/{$profile->id}", 'local');

        $attachment = Attachment::create([
            'uploaded_by' => AuthUser::id(),
            'file_name' => $file->getClientOriginalName(),
            'file_path' => $path,
            'disk' => 'local',
            'mime_type' => $file->getClientMimeType(),
            'file_size' => $file->getSize(),
            'attachable_type' => 'owner_profile',
            'attachable_id' => $profile->id,
            'document_type' => $request->validated('document_type'),
            'visibility' => Attachment::VISIBILITY_PRIVATE,
        ]);

        // One row per document type — re-uploading (e.g. after a rejected
        // document) replaces the previous attempt rather than piling up.
        $verification = OwnerVerification::updateOrCreate(
            ['owner_profile_id' => $profile->id, 'document_type' => $request->validated('document_type')],
            ['attachment_id' => $attachment->id, 'status' => 'pending', 'reviewed_by' => null, 'reviewed_at' => null, 'rejection_reason' => null]
        );

        return $this->response('Document uploaded', $verification->load('attachment'), 201);
    }

    public function submit(): JsonResponse
    {
        $profile = OwnerProfile::where('user_id', AuthUser::id())->firstOrFail();
        $profile = $this->service->submit($profile);

        return $this->response('Application submitted for review', $profile);
    }

    /** The applicant viewing their own uploaded document — never anyone else's. */
    public function downloadDocument(OwnerVerification $verification): StreamedResponse
    {
        abort_unless($verification->ownerProfile->user_id === AuthUser::id(), 403);

        $attachment = $verification->attachment;
        abort_unless(Storage::disk($attachment->disk)->exists($attachment->file_path), 404);

        AuditService::view('OwnerVerification', $verification->id, $attachment->file_name);

        return Storage::disk($attachment->disk)->download($attachment->file_path, $attachment->file_name);
    }
}
