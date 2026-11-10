<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Payout destination. account_number is encrypted at rest (see
 * App\Models\OwnerBankDetail casts) and no endpoint ever returns it -
 * only account_number_last4 is exposed for display. Restricted to the
 * shop's `owner` role member and platform finance admins.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('owner_bank_details', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shop_id')->constrained('rental_shops')->cascadeOnDelete();
            $table->string('account_holder_name');
            $table->string('bank_name');
            $table->string('bank_code')->nullable();
            $table->string('branch_name')->nullable();
            $table->string('branch_code')->nullable();
            $table->text('account_number'); // encrypted cast
            $table->string('account_number_last4', 4);
            $table->string('account_type')->nullable();
            $table->boolean('is_primary')->default(true);
            $table->enum('verification_status', ['unverified', 'pending', 'verified', 'rejected'])
                ->default('unverified');
            $table->foreignId('verified_by')->nullable()->constrained('system_admins')->nullOnDelete();
            $table->timestamp('verified_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['shop_id', 'is_primary']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('owner_bank_details');
    }
};
