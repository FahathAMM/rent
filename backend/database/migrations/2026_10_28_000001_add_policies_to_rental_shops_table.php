<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Shop policies become a vendor-defined list of { title, body } sections
 * instead of four fixed columns, so each shop can name and order its own
 * (fuel policy, deposit rules, late return fees...). Existing text from the
 * old columns is carried over as the first sections; the old columns are
 * left in place, unused, so nothing is lost.
 */
return new class extends Migration
{
    private const LEGACY = [
        'pickup_instructions' => 'Pickup instructions',
        'return_instructions' => 'Return instructions',
        'rental_terms' => 'Rental terms',
        'cancellation_policy' => 'Cancellation policy',
    ];

    public function up(): void
    {
        Schema::table('rental_shops', function (Blueprint $table) {
            $table->json('policies')->nullable()->after('operating_hours');
        });

        DB::table('rental_shops')->select(array_merge(['id'], array_keys(self::LEGACY)))->orderBy('id')
            ->each(function ($shop) {
                $policies = collect(self::LEGACY)
                    ->filter(fn ($title, $column) => filled($shop->{$column}))
                    ->map(fn ($title, $column) => ['title' => $title, 'body' => $shop->{$column}])
                    ->values()
                    ->all();

                if ($policies) {
                    DB::table('rental_shops')->where('id', $shop->id)->update(['policies' => json_encode($policies)]);
                }
            });
    }

    public function down(): void
    {
        Schema::table('rental_shops', function (Blueprint $table) {
            $table->dropColumn('policies');
        });
    }
};
