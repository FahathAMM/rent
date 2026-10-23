<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('company_settings', function (Blueprint $table) {
            $table->dropColumn([
                'quotation_prefix', 'payment_prefix', 'customer_prefix',
                'next_quotation_number', 'next_payment_number', 'next_customer_number',
                'default_tax_rate', 'quotation_terms', 'invoice_terms',
            ]);
        });
    }

    public function down(): void
    {
        Schema::table('company_settings', function (Blueprint $table) {
            $table->string('quotation_prefix')->default('QUO');
            $table->string('payment_prefix')->default('PAY');
            $table->string('customer_prefix')->default('CUS');

            $table->unsignedInteger('next_quotation_number')->default(1);
            $table->unsignedInteger('next_payment_number')->default(1);
            $table->unsignedInteger('next_customer_number')->default(1);

            $table->decimal('default_tax_rate', 5, 2)->default(5.00);

            $table->text('quotation_terms')->nullable();
            $table->text('invoice_terms')->nullable();
        });
    }
};
