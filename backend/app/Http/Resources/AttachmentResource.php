<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class AttachmentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id'            => $this->id,
            'file_name'     => $this->file_name,
            'mime_type'     => $this->mime_type,
            'file_size'     => $this->file_size,
            'document_type' => $this->document_type,
            'uploaded_by'   => $this->uploadedBy?->name,
            'created_at'    => $this->created_at,
        ];
    }
}
