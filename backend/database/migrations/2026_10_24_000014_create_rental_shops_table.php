<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A registered rental business - the only kind of vendor workspace.
 * Every vehicle belongs to exactly one row here; see
 * app-doc/marketplace/01-phase1-architecture.md section 3.1 for why
 * modelling it this way keeps every authorization check, scope, payout
 * and report to one shape.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rental_shops', function (Blueprint $table) {
            $table->id();
            $table->foreignId('owner_user_id')->constrained('users')->restrictOnDelete();
            $table->string('name');
            $table->string('slug')->unique();
            $table->text('description')->nullable();
            $table->string('tagline')->nullable();

            $table->string('email')->nullable();
            $table->string('phone')->nullable();
            $table->string('whatsapp')->nullable();
            $table->string('website')->nullable();

            $table->string('address_line_1')->nullable();
            $table->string('address_line_2')->nullable();
            $table->string('city')->nullable();
            $table->string('district')->nullable();
            $table->string('postal_code')->nullable();
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();

            $table->json('operating_hours')->nullable();
            $table->json('policies')->nullable();
            $table->time('booking_pickup_time')->default('10:00:00');
            $table->time('booking_return_time')->default('10:00:00');
            $table->text('pickup_instructions')->nullable();
            $table->text('return_instructions')->nullable();
            $table->text('rental_terms')->nullable();
            $table->text('cancellation_policy')->nullable();

            $table->string('logo')->nullable();
            $table->string('cover_image')->nullable();

            $table->string('business_registration_no')->nullable();
            $table->string('tax_id')->nullable();

            $table->enum('status', ['draft', 'pending_review', 'active', 'suspended', 'rejected'])
                ->default('draft');
            $table->enum('verification_status', ['unverified', 'pending', 'verified', 'rejected'])
                ->default('unverified');
            $table->timestamp('verified_at')->nullable();
            $table->foreignId('verified_by')->nullable()->constrained('system_admins')->nullOnDelete();
            $table->boolean('is_published')->default(false);
            $table->timestamp('published_at')->nullable();
            $table->string('suspended_reason')->nullable();

            $table->decimal('advance_percentage', 5, 2)->nullable()->default(5);

            $table->decimal('rating_avg', 3, 2)->default(0);
            $table->unsignedInteger('rating_count')->default(0);
            $table->unsignedInteger('completed_bookings_count')->default(0);
            $table->decimal('response_rate', 5, 2)->nullable();
            $table->unsignedInteger('avg_response_minutes')->nullable();

            $table->timestamps();
            $table->softDeletes();

            $table->index('owner_user_id');
            $table->index(['status', 'is_published']);
            $table->index('verification_status');
        });

        // users.shop_id is declared in the users migration; its key can only be added once rental_shops exists.
        Schema::table('users', function (Blueprint $table) {
            $table->foreign('shop_id')->references('id')->on('rental_shops')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('users', fn (Blueprint $table) => $table->dropForeign(['shop_id']));
        Schema::dropIfExists('rental_shops');
    }
};
