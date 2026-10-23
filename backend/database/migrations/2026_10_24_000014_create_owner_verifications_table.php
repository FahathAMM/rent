<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('owner_verifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('owner_profile_id')->constrained('owner_profiles')->cascadeOnDelete();
            $table->enum('document_type', [
                'nic_front', 'nic_back', 'selfie_with_nic', 'proof_of_address',
                'driving_licence', 'vehicle_registration', 'insurance_certificate',
                'revenue_licence', 'other',
            ]);
            $table->foreignId('attachment_id')->constrained('attachments')->cascadeOnDelete();
            $table->enum('status', ['pending', 'verified', 'rejected'])->default('pending');
            $table->foreignId('reviewed_by')->nullable()->constrained('system_admins')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->string('rejection_reason')->nullable();
            $table->date('expires_at')->nullable();
            $table->timestamps();

            $table->index(['owner_profile_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('owner_verifications');
    }
};
