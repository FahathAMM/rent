<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A vehicle becomes publicly visible only when status = published AND
 * moderation_status = approved AND its shop is active + is_published - see
 * app-doc/marketplace/01-phase1-architecture.md section 3.1.
 * registration_number is private (owner/staff/admin and the confirmed
 * renter only) - never returned by a public resource.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vehicles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shop_id')->constrained('rental_shops')->cascadeOnDelete();
            $table->foreignId('category_id')->constrained('vehicle_categories')->restrictOnDelete();
            // Nullable so older rows/fixtures stay valid; the vendor form requires it.
            $table->foreignId('brand_id')->nullable()->constrained('vehicle_brands')->restrictOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();

            $table->string('title');
            $table->string('slug')->unique();
            $table->string('make'); // the brand's name, denormalised from brand_id
            $table->string('model');
            $table->unsignedSmallInteger('year');
            $table->string('variant')->nullable();
            $table->string('colour')->nullable();
            $table->string('registration_number');

            $table->enum('transmission', ['manual', 'automatic', 'semi_automatic', 'cvt']);
            $table->enum('fuel_type', ['petrol', 'diesel', 'hybrid', 'electric', 'lpg']);
            $table->unsignedInteger('engine_capacity_cc')->nullable();
            $table->unsignedTinyInteger('seating_capacity');
            $table->unsignedTinyInteger('luggage_capacity')->nullable();
            $table->unsignedTinyInteger('doors')->nullable();
            $table->boolean('air_conditioned')->default(true);
            $table->json('features')->nullable();
            $table->text('description')->nullable();
            $table->text('condition_notes')->nullable();

            $table->enum('status', ['draft', 'pending_review', 'published', 'unpublished', 'archived', 'rejected'])
                ->default('draft');
            $table->enum('moderation_status', ['pending', 'approved', 'rejected', 'flagged'])->default('pending');
            $table->string('moderation_note')->nullable();
            $table->timestamp('published_at')->nullable();
            $table->timestamp('archived_at')->nullable();

            $table->boolean('is_featured')->default(false);
            $table->timestamp('featured_until')->nullable();

            $table->decimal('rating_avg', 3, 2)->default(0);
            $table->unsignedInteger('rating_count')->default(0);
            $table->unsignedInteger('view_count')->default(0);
            $table->unsignedInteger('inquiry_count')->default(0);
            $table->unsignedInteger('booking_count')->default(0);
            $table->timestamp('last_booked_at')->nullable();

            $table->timestamps();
            $table->softDeletes();

            $table->index(['shop_id', 'status']);
            $table->index(['category_id', 'status', 'moderation_status']);
            $table->index(['status', 'moderation_status', 'published_at']);
            $table->index(['is_featured', 'featured_until']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vehicles');
    }
};
