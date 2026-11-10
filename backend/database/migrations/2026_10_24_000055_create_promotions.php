<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Paid visibility — app-doc/marketplace/10-monetization.md 2.2.
 *
 *  promotion_packages  What can be bought: "featured" (one vehicle at the top of search, the home row, a badge)
 *                      or "sponsored" (a shop pinned at the top of its city's results),
 *                      each for N days at a price. Admin-editable.
 *  promotions          One purchase / admin grant. Live while approved and starts_at <= now < ends_at —
 *                      worked out at read time, nothing runs on a schedule. Receipt = Attachment
 *                      (document_type promotion_proof).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('promotion_packages', function (Blueprint $table) {
            $table->id();
            $table->string('type', 20);                   // featured | sponsored
            $table->string('name', 80);
            $table->unsignedSmallInteger('days');
            $table->decimal('price', 12, 2);
            $table->boolean('is_active')->default(true);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['type', 'is_active']);
        });

        Schema::create('promotions', function (Blueprint $table) {
            $table->id();
            $table->string('reference_no', 30)->unique();
            $table->foreignId('shop_id')->constrained('rental_shops')->cascadeOnDelete();
            $table->foreignId('package_id')->nullable()->constrained('promotion_packages')->nullOnDelete();
            $table->string('type', 20);                   // featured | sponsored
            $table->foreignId('vehicle_id')->nullable()->constrained('vehicles')->cascadeOnDelete();     // featured
            $table->string('city', 100)->nullable();        // sponsored
            $table->unsignedSmallInteger('days');
            $table->decimal('amount', 12, 2)->default(0);
            $table->string('kind', 20)->default('paid');  // paid | granted
            $table->string('status', 20)->default('pending'); // pending | approved | rejected
            $table->dateTime('starts_at')->nullable();
            $table->dateTime('ends_at')->nullable();
            $table->string('bank_reference')->nullable();
            $table->string('note')->nullable();
            $table->foreignId('submitted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('reviewed_by')->nullable()->constrained('system_admins')->nullOnDelete();
            $table->dateTime('reviewed_at')->nullable();
            $table->string('reject_reason')->nullable();
            $table->timestamps();

            $table->index(['type', 'status', 'starts_at', 'ends_at']);
            $table->index(['shop_id', 'status']);
        });

        $now = now();
        DB::table('promotion_packages')->insert([
            ['type' => 'featured', 'name' => 'Featured — 7 days', 'days' => 7, 'price' => 1000, 'is_active' => true, 'sort_order' => 1, 'created_at' => $now, 'updated_at' => $now],
            ['type' => 'featured', 'name' => 'Featured — 30 days', 'days' => 30, 'price' => 3000, 'is_active' => true, 'sort_order' => 2, 'created_at' => $now, 'updated_at' => $now],
            ['type' => 'sponsored', 'name' => 'Sponsored — 7 days', 'days' => 7, 'price' => 2500, 'is_active' => true, 'sort_order' => 3, 'created_at' => $now, 'updated_at' => $now],
            ['type' => 'sponsored', 'name' => 'Sponsored — 30 days', 'days' => 30, 'price' => 8000, 'is_active' => true, 'sort_order' => 4, 'created_at' => $now, 'updated_at' => $now],
        ]);

        foreach ([
            ['featured_listing_slots', 12, 'Featured listing slots', 'How many vehicles can be featured at the same time.'],
            ['sponsored_slots_per_target', 3, 'Sponsored slots per category / city', 'How many shops can sponsor the same category or city at the same time.'],
        ] as [$key, $value, $label, $description]) {
            DB::table('platform_settings')->updateOrInsert(['key' => $key], [
                'value' => json_encode(['value' => $value]), 'group' => 'promotions', 'label' => $label,
                'description' => $description, 'type' => 'integer', 'is_public' => false, 'created_at' => $now, 'updated_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('promotions');
        Schema::dropIfExists('promotion_packages');
        DB::table('platform_settings')->where('group', 'promotions')->delete();
    }
};
