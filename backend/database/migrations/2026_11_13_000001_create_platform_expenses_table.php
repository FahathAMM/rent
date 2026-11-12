<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The platform's own running costs (hosting, marketing, salaries, ...), recorded by the
 * Platform Owner so /platform/accounts can show profit and loss. Nothing to do with the
 * shops' `expenses` table, which is per shop and per vehicle.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('platform_expenses', function (Blueprint $table) {
            $table->id();
            $table->string('expense_number', 30)->unique();
            $table->date('expense_date');
            $table->string('category', 40);      // see PlatformExpense::CATEGORIES
            $table->string('paid_to', 150)->nullable();
            $table->string('description')->nullable();
            $table->decimal('amount', 12, 2);
            $table->string('payment_method', 30)->nullable();
            $table->string('reference_no', 100)->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('system_admins')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index('expense_date');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('platform_expenses');
    }
};
