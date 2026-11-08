<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Shop subscription plans — see app-doc/marketplace/10-monetization.md.
 *
 *  subscription_plans     Basic / Pro / Business (admin-editable): price per period, limits, feature switches.
 *  shop_subscriptions     One row per trial / paid period / admin grant. The shop's current plan is
 *                         worked out at read time (App\Services\SubscriptionService), so nothing has to
 *                         run on a schedule when a period ends.
 *  subscription_payments  A shop's bank transfer to the platform + receipt, verified by a platform admin.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('subscription_plans', function (Blueprint $table) {
            $table->id();
            $table->string('code', 40)->unique();
            $table->string('name', 80);
            $table->text('description')->nullable();
            $table->decimal('price', 12, 2)->default(0);           // per period, LKR
            $table->unsignedSmallInteger('period_days')->default(30);
            $table->unsignedInteger('max_vehicles')->nullable();   // null = unlimited
            $table->unsignedInteger('max_sale_listings')->nullable(); // null = unlimited
            $table->unsignedInteger('max_staff')->nullable();
            $table->unsignedInteger('max_locations')->nullable();
            $table->json('features')->nullable();                  // ["staff","expenses","calendar","sales","reports"]
            $table->boolean('is_active')->default(true);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
        });

        Schema::create('shop_subscriptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shop_id')->constrained('rental_shops')->cascadeOnDelete();
            $table->foreignId('plan_id')->constrained('subscription_plans');
            $table->string('kind', 20);                 // trial | paid | granted
            $table->dateTime('starts_at');
            $table->dateTime('ends_at');
            $table->string('note')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('system_admins')->nullOnDelete();
            $table->timestamps();

            $table->index(['shop_id', 'ends_at']);
        });

        Schema::create('subscription_payments', function (Blueprint $table) {
            $table->id();
            $table->string('reference_no', 30)->unique();
            $table->foreignId('shop_id')->constrained('rental_shops')->cascadeOnDelete();
            $table->foreignId('plan_id')->constrained('subscription_plans');
            $table->unsignedSmallInteger('periods')->default(1);
            $table->decimal('amount', 12, 2);
            $table->string('bank_reference')->nullable();
            $table->string('status', 20)->default('pending'); // pending | approved | rejected
            $table->foreignId('submitted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('reviewed_by')->nullable()->constrained('system_admins')->nullOnDelete();
            $table->dateTime('reviewed_at')->nullable();
            $table->string('reject_reason')->nullable();
            $table->foreignId('shop_subscription_id')->nullable()->constrained('shop_subscriptions')->nullOnDelete();
            $table->timestamps();

            $table->index(['status', 'created_at']);
        });

        $now = now();
        DB::table('subscription_plans')->insert([
            [
                'code' => 'basic', 'name' => 'Basic', 'description' => 'For a small shop: list a couple of vehicles and take bookings.',
                'price' => 500, 'period_days' => 30, 'max_vehicles' => 2, 'max_sale_listings' => 2, 'max_staff' => 0, 'max_locations' => 1,
                'features' => json_encode(['sales']), 'is_active' => true, 'sort_order' => 1, 'created_at' => $now, 'updated_at' => $now,
            ],
            [
                'code' => 'pro', 'name' => 'Pro', 'description' => 'For a growing shop: more vehicles, the availability calendar and expenses.',
                'price' => 2500, 'period_days' => 30, 'max_vehicles' => 10, 'max_sale_listings' => 10, 'max_staff' => 2, 'max_locations' => 3,
                'features' => json_encode(['calendar', 'expenses', 'staff', 'sales', 'reports']), 'is_active' => true, 'sort_order' => 2, 'created_at' => $now, 'updated_at' => $now,
            ],
            [
                'code' => 'business', 'name' => 'Business', 'description' => 'Unlimited vehicles, staff and branches.',
                'price' => 6000, 'period_days' => 30, 'max_vehicles' => null, 'max_sale_listings' => null, 'max_staff' => null, 'max_locations' => null,
                'features' => json_encode(['calendar', 'expenses', 'staff', 'sales', 'reports']), 'is_active' => true, 'sort_order' => 3, 'created_at' => $now, 'updated_at' => $now,
            ],
        ]);

        foreach ([
            ['subscription_trial_plan', 'pro', 'Trial plan', 'Plan code a newly verified shop gets as a free trial.', 'string'],
            ['subscription_trial_days', 30, 'Trial length (days)', 'How long the free trial lasts.', 'integer'],
            ['subscription_grace_days', 7, 'Grace period (days)', 'Days a paid plan keeps working after it ends, before falling back to Free.', 'integer'],
            ['subscription_bank_details', ['bank_name' => '', 'branch' => '', 'account_name' => '', 'account_number' => '', 'instructions' => ''], 'Platform bank account', 'Where shops transfer subscription payments.', 'json'],
        ] as [$key, $value, $label, $description, $type]) {
            DB::table('platform_settings')->updateOrInsert(['key' => $key], [
                'value' => json_encode(['value' => $value]), 'group' => 'subscriptions', 'label' => $label,
                'description' => $description, 'type' => $type, 'is_public' => false, 'created_at' => $now, 'updated_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('subscription_payments');
        Schema::dropIfExists('shop_subscriptions');
        Schema::dropIfExists('subscription_plans');
        DB::table('platform_settings')->where('group', 'subscriptions')->delete();
    }
};
