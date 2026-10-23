<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The individual-owner application: identity, KYC and approval state.
 * On approval, a personal rental_shops row (shop_type = individual) is
 * auto-provisioned for this user - see OwnerOnboardingService (later
 * phase). nic_number is encrypted at rest.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('owner_profiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained('users')->cascadeOnDelete();
            $table->enum('applicant_type', ['individual', 'business'])->default('individual');
            $table->string('full_name');
            $table->text('nic_number'); // encrypted cast
            $table->date('date_of_birth')->nullable();
            $table->string('contact_phone');
            $table->string('alt_phone')->nullable();
            $table->string('address_line_1')->nullable();
            $table->string('address_line_2')->nullable();
            $table->string('city')->nullable();
            $table->string('district')->nullable();
            $table->string('postal_code')->nullable();
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();

            $table->enum('status', [
                'draft', 'submitted', 'under_review', 'info_requested',
                'approved', 'rejected', 'suspended',
            ])->default('draft');
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('system_admins')->nullOnDelete();
            $table->string('rejection_reason')->nullable();
            $table->text('info_requested_note')->nullable();
            $table->timestamp('info_requested_at')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('suspended_at')->nullable();
            $table->string('suspension_reason')->nullable();
            $table->timestamp('terms_accepted_at')->nullable();

            $table->timestamps();
            $table->softDeletes();

            $table->index(['status', 'submitted_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('owner_profiles');
    }
};
