<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Paid visibility — app-doc/marketplace/10-monetization.md 2.2.
 *
 *  promotion_packages  What can be bought: "featured" (one vehicle at the top of search, the home row, a badge)
 *                      or "sponsored" (a shop pinned at the top of one category's or its city's results),
 *                      each for N days at a price. Admin-editable.
 *  promotions          One purchase / admin grant. Live while approved and starts_at <= now < ends_at —
 *                      worked out at read time, nothing runs on a schedule. Receipt = Attachment
 *                      (document_type promotion_proof).
 *
 * Replaces vehicles.is_featured / featured_until: listings featured today become 30-day granted promotions.
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
            $table->string('target_type', 20)->nullable(); // sponsored: category | city
            $table->foreignId('category_id')->nullable()->constrained('vehicle_categories')->cascadeOnDelete();
            $table->string('city', 100)->nullable();
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

        // Today's featured listings carry on as 30-day (or their own end date) granted promotions.
        $featured = DB::table('vehicles')->where('is_featured', true)->get(['id', 'shop_id', 'featured_until']);
        foreach ($featured as $i => $vehicle) {
            $ends = $vehicle->featured_until && $vehicle->featured_until > $now ? $vehicle->featured_until : $now->copy()->addDays(30);
            DB::table('promotions')->insert([
                'reference_no' => 'PRM-' . $now->format('ymd') . '-M' . str_pad((string) ($i + 1), 4, '0', STR_PAD_LEFT),
                'shop_id' => $vehicle->shop_id, 'type' => 'featured', 'vehicle_id' => $vehicle->id,
                'days' => 30, 'amount' => 0, 'kind' => 'granted', 'status' => 'approved',
                'starts_at' => $now, 'ends_at' => $ends, 'note' => 'Featured before promotions existed',
                'reviewed_at' => $now, 'created_at' => $now, 'updated_at' => $now,
            ]);
        }

        Schema::table('vehicles', function (Blueprint $table) {
            $table->dropIndex(['is_featured', 'featured_until']);
            $table->dropColumn(['is_featured', 'featured_until']);
        });
    }

    public function down(): void
    {
        Schema::table('vehicles', function (Blueprint $table) {
            $table->boolean('is_featured')->default(false);
            $table->timestamp('featured_until')->nullable();
            $table->index(['is_featured', 'featured_until']);
        });
        DB::table('promotions')->where('type', 'featured')->where('status', 'approved')->where('ends_at', '>', now())
            ->get(['vehicle_id', 'ends_at'])
            ->each(fn ($p) => DB::table('vehicles')->where('id', $p->vehicle_id)->update(['is_featured' => true, 'featured_until' => $p->ends_at]));

        Schema::dropIfExists('promotions');
        Schema::dropIfExists('promotion_packages');
        DB::table('platform_settings')->where('group', 'promotions')->delete();
    }
};
