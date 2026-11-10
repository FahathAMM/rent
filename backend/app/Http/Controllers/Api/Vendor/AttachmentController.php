<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Attachment\StoreAttachmentRequest;
use App\Http\Resources\AttachmentResource;
use App\Models\Attachment;
use App\Repositories\AttachmentRepo;
use App\Services\AuditService;
use App\Services\AuthUser;
use App\Traits\JsonResponse as JsonResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Cross-cutting — the required permission depends on which model the
 * attachment belongs to, so it's checked per-request here rather than via
 * a fixed `can:` middleware (see PERMISSIONS below).
 *
 * This simple "permission-slug per type" pattern only fits attachable
 * types with uniform, permission-gated visibility (expenses today).
 * Vehicle images (public), owner/shop verification documents (private,
 * signed download only) and dispute evidence (restricted) each need
 * their own visibility rules and get dedicated upload/download endpoints
 * in a later phase instead of being added here - see
 * app-doc/marketplace/02-data-model.md "attachments" and
 * app-doc/marketplace/05-ui-and-api-map.md.
 */
class AttachmentController extends Controller
{
    use JsonResponseTrait;

    private const PERMISSIONS = [
        'expense' => 'vendor-expense-expenses',
    ];

    public function __construct(private AttachmentRepo $repo) {}

    public function index(Request $request): JsonResponse
    {
        $data = $request->validate([
            'attachable_type' => 'required|in:expense',
            'attachable_id'   => 'required|integer',
        ]);

        $this->authorizeFor($data['attachable_type'], 'view');

        return $this->response('Attachments retrieved successfully', AttachmentResource::collection(
            $this->repo->forAttachable($data['attachable_type'], (int) $data['attachable_id'])
        ));
    }

    public function store(StoreAttachmentRequest $request): JsonResponse
    {
        $this->authorizeFor($request->validated('attachable_type'), 'edit');

        $attachment = $this->repo->store($request);

        AuditService::create('Attachment', $attachment->id, $attachment->file_name);

        return $this->response('File uploaded successfully', new AttachmentResource($attachment), 201);
    }

    public function download(Attachment $attachment): StreamedResponse
    {
        $this->authorizeFor($attachment->attachable_type, 'view');

        abort_unless(Storage::disk('local')->exists($attachment->file_path), 404);

        return Storage::disk('local')->download($attachment->file_path, $attachment->file_name);
    }

    public function destroy(Attachment $attachment): JsonResponse
    {
        $this->authorizeFor($attachment->attachable_type, 'edit');

        $name = $attachment->file_name;
        $this->repo->destroy($attachment);

        AuditService::delete('Attachment', $attachment->id, $name);

        return $this->response('File deleted successfully');
    }

    private function authorizeFor(string $type, string $action): void
    {
        $slug = self::PERMISSIONS[$type] ?? abort(422, "Unknown attachable type [{$type}].");

        abort_unless(AuthUser::can("{$slug}-{$action}"), 403);
    }
}
