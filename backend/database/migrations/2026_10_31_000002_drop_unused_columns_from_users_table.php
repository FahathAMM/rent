<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * users is the vendor/owner/staff identity only (customers have their own
 * table), and these columns are never set for it: no phone verification,
 * date of birth or address is ever captured, and account suspension of
 * customers moved to the customers table (shops keep their own
 * suspended_reason on rental_shops).
 */
return new class extends Migration
{
    private const COLUMNS = ['phone_country', 'phone_verified_at', 'date_of_birth', 'address', 'suspended_reason', 'suspended_at'];

    public function up(): void
    {
        $existing = array_values(array_filter(self::COLUMNS, fn ($c) => Schema::hasColumn('users', $c)));
        if ($existing) {
            Schema::table('users', fn (Blueprint $table) => $table->dropColumn($existing));
        }
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('phone_country', 2)->default('LK')->after('phone');
            $table->timestamp('phone_verified_at')->nullable()->after('phone_country');
            $table->date('date_of_birth')->nullable()->after('avatar');
            $table->text('address')->nullable()->after('date_of_birth');
            $table->string('suspended_reason')->nullable()->after('status');
            $table->timestamp('suspended_at')->nullable()->after('suspended_reason');
        });
    }
};
