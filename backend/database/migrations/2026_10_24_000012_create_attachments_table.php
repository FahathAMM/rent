<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Generic polymorphic uploads - vehicle photos, shop logos, KYC/verification
 * documents, inspection photos, payout settlement evidence. shop_id is
 * nullable: an owner's KYC documents are attached before their personal
 * shop exists (during onboarding).
 *
 * visibility drives where a file is actually stored and served:
 *   public     -> public disk, CDN-cacheable (vehicle/shop images)
 *   private    -> private disk, signed short-lived download route only
 *                 (KYC, bank proof, payout evidence) - every access audited
 *   restricted -> private disk, permission-checked (inspection photos,
 *                 damage photos - visible to the booking's two parties and
 *                 platform staff, not the public)
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('attachments', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('shop_id')->nullable();
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('file_name');
            $table->string('file_path');
            $table->string('disk')->default('public');
            $table->string('mime_type')->nullable();
            $table->unsignedBigInteger('file_size')->nullable();
            $table->string('checksum', 64)->nullable();
            $table->string('attachable_type');
            $table->unsignedBigInteger('attachable_id');
            $table->string('document_type')->nullable();
            $table->enum('visibility', ['public', 'private', 'restricted'])->default('private');
            $table->timestamps();

            $table->index(['shop_id', 'attachable_type', 'attachable_id']);
            $table->index('visibility');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('attachments');
    }
};
