<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * There is no free plan any more: the old Free row becomes Basic (LKR 500 per
 * 30 days, same limits). A shop with no running plan is "unpaid" and its
 * vendor workspace is locked until a payment is approved (SubscriptionService).
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('subscription_plans')->where('code', 'free')->update([
            'code' => 'basic',
            'name' => 'Basic',
            'description' => 'For a small shop: list a couple of vehicles and take bookings.',
            'price' => 500,
            'is_active' => true,
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        DB::table('subscription_plans')->where('code', 'basic')->update([
            'code' => 'free', 'name' => 'Free', 'description' => 'Get listed and take bookings.', 'price' => 0, 'updated_at' => now(),
        ]);
    }
};
