<?php

namespace App\Repositories;

use App\Http\Requests\Attachment\StoreAttachmentRequest;
use App\Models\Attachment;
use App\Services\AuthUser;
use App\Support\VendorContext;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Support\Facades\Storage;

/**
 * Generic polymorphic attachments — not tied to any one model. The
 * attachable is always resolved through Relation::morphMap() (see
 * AppServiceProvider::boot), so a client only ever sends a short alias
 * ("expense"), and Eloquent's own global ShopScope on that model
 * guarantees the record belongs to the active shop.
 */
class AttachmentRepo
{
    public function forAttachable(string $type, int $id): Collection
    {
        $this->resolve($type, $id);

        return Attachment::where('attachable_type', $type)
            ->where('attachable_id', $id)
            ->with('uploadedBy')
            ->latest()
            ->get();
    }

    public function store(StoreAttachmentRequest $request): Attachment
    {
        $data = $request->validated();
        $attachable = $this->resolve($data['attachable_type'], $data['attachable_id']);

        $file = $request->file('file');
        $path = $file->store("attachments/{$data['attachable_type']}/{$attachable->id}", 'local');

        return $attachable->attachments()->create([
            'shop_id'       => VendorContext::shopId(),
            'uploaded_by'   => AuthUser::id(),
            'file_name'     => $file->getClientOriginalName(),
            'file_path'     => $path,
            'mime_type'     => $file->getClientMimeType(),
            'file_size'     => $file->getSize(),
            'document_type' => $data['document_type'] ?? null,
        ]);
    }

    public function destroy(Attachment $attachment): void
    {
        Storage::disk('local')->delete($attachment->file_path);
        $attachment->delete();
    }

    /** Resolves the morph alias to its model and 404s unless it exists in the active shop (ShopScope). */
    private function resolve(string $type, int $id): Model
    {
        $class = Relation::getMorphedModel($type) ?? abort(422, "Unknown attachable type [{$type}].");

        return $class::findOrFail($id);
    }
}
