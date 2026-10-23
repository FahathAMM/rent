<?php

namespace App\Models;

use App\Models\Administration\User;
use App\Models\Concerns\BelongsToCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class Attachment extends Model
{
    use HasFactory, BelongsToCompany;

    protected $fillable = [
        'company_id', 'uploaded_by', 'file_name', 'file_path', 'mime_type',
        'file_size', 'attachable_type', 'attachable_id', 'document_type',
    ];

    public function uploadedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    public function attachable(): MorphTo
    {
        return $this->morphTo();
    }
}
