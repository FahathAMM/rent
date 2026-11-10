<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shop_verifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shop_id')->constrained('rental_shops')->cascadeOnDelete();
            $table->enum('document_type', [
                'business_registration', 'tax_identification', 'bank_statement',
                'insurance_policy', 'trade_licence', 'lease_agreement', 'other',
            ]);
            $table->foreignId('attachment_id')->constrained('attachments')->cascadeOnDelete();
            $table->enum('status', ['pending', 'verified', 'rejected'])->default('pending');
            $table->foreignId('reviewed_by')->nullable()->constrained('system_admins')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->string('rejection_reason')->nullable();
            $table->date('expires_at')->nullable();
            $table->timestamps();

            $table->index(['shop_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shop_verifications');
    }
};
