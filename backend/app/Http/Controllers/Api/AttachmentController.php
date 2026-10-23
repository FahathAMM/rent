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
 * a fixed `can:` middleware (see PERMISSIONS below, extended as new
 * attachable types are added to AppServiceProvider's morphMap).
 */
class AttachmentController extends Controller
{
    use JsonResponseTrait;

    private const PERMISSIONS = [
        'expense'  => 'expense-expenses',
        'purchase' => 'purchasing-purchases',
        'sale'     => 'sales-orders',
    ];

    public function __construct(private AttachmentRepo $repo) {}

    public function index(Request $request): JsonResponse
    {
        $data = $request->validate([
            'attachable_type' => 'required|in:expense,purchase,sale',
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
