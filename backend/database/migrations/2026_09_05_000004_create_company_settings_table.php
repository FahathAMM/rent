<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('company_settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->unique()->constrained()->cascadeOnDelete();

            $table->string('quotation_prefix')->default('QUO');
            $table->string('invoice_prefix')->default('INV');
            $table->string('payment_prefix')->default('PAY');
            $table->string('expense_prefix')->default('EXP');
            $table->string('customer_prefix')->default('CUS');

            $table->unsignedInteger('next_quotation_number')->default(1);
            $table->unsignedInteger('next_invoice_number')->default(1);
            $table->unsignedInteger('next_payment_number')->default(1);
            $table->unsignedInteger('next_expense_number')->default(1);
            $table->unsignedInteger('next_customer_number')->default(1);

            $table->decimal('default_tax_rate', 5, 2)->default(5.00);

            $table->text('quotation_terms')->nullable();
            $table->text('invoice_terms')->nullable();
            $table->text('invoice_footer')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('company_settings');
    }
};
