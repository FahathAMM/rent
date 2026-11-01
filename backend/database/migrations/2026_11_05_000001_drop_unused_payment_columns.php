<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Slims payments down to what the paid-to-shop flow uses:
 *  - gateway duplicated method (cash = cash, bank_transfer = bank) - method
 *    is now the one column, and required;
 *  - method_detail (shop-recorded flag + note), failed_at and
 *    failure_reason are dropped for now. A rejected transfer is still
 *    status = failed; the reason goes to the customer in the rejection
 *    notification only.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('payments')->whereNull('method')->where('gateway', 'bank_transfer')->update(['method' => 'bank']);
        DB::table('payments')->whereNull('method')->update(['method' => 'cash']);
        DB::statement("ALTER TABLE payments MODIFY method ENUM('cash','bank') NOT NULL");

        Schema::table('payments', function (Blueprint $table) {
            $table->dropColumn(['gateway', 'method_detail', 'failed_at', 'failure_reason']);
        });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->enum('gateway', ['cash', 'bank_transfer'])->default('cash')->after('payment_reference');
            $table->json('method_detail')->nullable()->after('method');
            $table->timestamp('failed_at')->nullable()->after('paid_at');
            $table->string('failure_reason')->nullable()->after('failed_at');
        });
        DB::table('payments')->where('method', 'bank')->update(['gateway' => 'bank_transfer']);
        DB::statement("ALTER TABLE payments MODIFY gateway ENUM('cash','bank_transfer') NOT NULL");
        DB::statement("ALTER TABLE payments MODIFY method ENUM('cash','bank') NULL");
    }
};
