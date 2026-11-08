<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Phase 1 of vehicle sales — see app-doc/marketplace/13-vehicle-sales.md
 * section 3. Test drives and reservations come with phase 2, which also adds
 * vehicle_sales.reservation_id (its table doesn't exist yet).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vehicle_sale_details', function (Blueprint $table) {
            $table->foreignId('vehicle_id')->primary()->constrained('vehicles')->cascadeOnDelete();
            $table->foreignId('shop_id')->constrained('rental_shops')->cascadeOnDelete();
            $table->decimal('price', 14, 2);
            $table->char('currency', 3)->default('LKR');
            $table->boolean('is_negotiable')->default(false);
            $table->unsignedInteger('mileage_km');
            $table->enum('condition', ['brand_new', 'reconditioned', 'used']);
            $table->unsignedTinyInteger('owners_count')->nullable();
            $table->unsignedSmallInteger('warranty_months')->nullable();
            $table->enum('sale_status', ['available', 'reserved', 'sold', 'withdrawn'])->default('available');
            $table->timestamp('reserved_until')->nullable();
            $table->timestamps();

            $table->index(['sale_status', 'price']);
            $table->index(['shop_id', 'sale_status']);
        });

        Schema::create('sale_enquiries', function (Blueprint $table) {
            $table->id();
            $table->string('reference')->unique();
            $table->foreignId('vehicle_id')->constrained('vehicles')->cascadeOnDelete();
            $table->foreignId('shop_id')->constrained('rental_shops')->cascadeOnDelete();
            $table->foreignId('customer_id')->constrained('customers')->restrictOnDelete();
            $table->enum('type', ['question', 'test_drive', 'offer'])->default('question');
            $table->decimal('offer_amount', 14, 2)->nullable();
            $table->enum('status', ['new', 'replied', 'accepted', 'declined', 'closed'])->default('new');
            $table->timestamp('last_message_at')->nullable();
            $table->string('closed_reason')->nullable();
            $table->timestamps();

            $table->index(['shop_id', 'status', 'last_message_at']);
            $table->index(['customer_id', 'last_message_at']);
        });

        Schema::create('sale_enquiry_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('enquiry_id')->constrained('sale_enquiries')->cascadeOnDelete();
            $table->enum('sender_type', ['customer', 'shop']);
            $table->unsignedBigInteger('sender_id');
            $table->text('body');
            $table->decimal('offer_amount', 14, 2)->nullable();
            $table->timestamp('read_at')->nullable();
            $table->timestamp('created_at')->nullable();

            $table->index(['enquiry_id', 'created_at']);
        });

        // No soft deletes: vehicle_id is unique, so a soft-deleted sale would block the car from being sold again.
        Schema::create('vehicle_sales', function (Blueprint $table) {
            $table->id();
            $table->string('reference')->unique();
            $table->foreignId('vehicle_id')->unique()->constrained('vehicles')->restrictOnDelete();
            $table->foreignId('shop_id')->constrained('rental_shops')->restrictOnDelete();
            $table->foreignId('customer_id')->nullable()->constrained('customers')->nullOnDelete();
            $table->foreignId('enquiry_id')->nullable()->constrained('sale_enquiries')->nullOnDelete();
            $table->string('buyer_name');
            $table->string('buyer_phone');
            $table->text('buyer_nic'); // encrypted cast: the ciphertext outgrows a varchar(255)
            $table->text('buyer_address')->nullable();
            $table->decimal('sale_price', 14, 2);
            $table->enum('payment_method', ['cash', 'bank_transfer', 'lease', 'other']);
            $table->dateTime('sold_at');
            $table->longText('terms_snapshot')->nullable();
            $table->string('buyer_signature_path')->nullable();
            $table->timestamp('terms_accepted_at')->nullable();
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['shop_id', 'sold_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vehicle_sales');
        Schema::dropIfExists('sale_enquiry_messages');
        Schema::dropIfExists('sale_enquiries');
        Schema::dropIfExists('vehicle_sale_details');
    }
};
