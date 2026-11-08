<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * unique(booking_id) - one review per booking, and a booking only becomes
 * reviewable at status = completed within review_eligible_until, so every
 * published review is provably tied to a real completed rental.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('reviews', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->unique()->constrained('bookings')->cascadeOnDelete();
            $table->foreignId('vehicle_id')->constrained('vehicles')->cascadeOnDelete();
            $table->foreignId('shop_id')->constrained('rental_shops')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();

            $table->unsignedTinyInteger('rating');
            $table->unsignedTinyInteger('rating_cleanliness')->nullable();
            $table->unsignedTinyInteger('rating_condition')->nullable();
            $table->unsignedTinyInteger('rating_value')->nullable();
            $table->unsignedTinyInteger('rating_communication')->nullable();
            $table->unsignedTinyInteger('rating_accuracy')->nullable();

            $table->string('title')->nullable();
            $table->text('comment')->nullable();

            $table->enum('status', ['pending', 'published', 'rejected', 'hidden'])->default('pending');
            $table->foreignId('moderated_by')->nullable()->constrained('system_admins')->nullOnDelete();
            $table->timestamp('moderated_at')->nullable();
            $table->string('moderation_reason')->nullable();

            $table->text('owner_reply')->nullable();
            $table->timestamp('owner_replied_at')->nullable();
            $table->foreignId('owner_replied_by')->nullable()->constrained('users')->nullOnDelete();

            $table->unsignedInteger('helpful_count')->default(0);
            $table->boolean('is_verified_booking')->default(true);

            $table->timestamps();

            $table->index(['vehicle_id', 'status']);
            $table->index(['shop_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reviews');
    }
};
