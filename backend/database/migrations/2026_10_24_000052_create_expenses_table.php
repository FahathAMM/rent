<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Repurposed from the old chicken-shop general expense ledger into
 * per-vehicle running costs (fuel, service, insurance, licence, ...) so
 * owner profit reporting is real - see
 * app-doc/marketplace/01-phase1-architecture.md section 1.1.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('expenses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shop_id')->constrained('rental_shops')->cascadeOnDelete();
            $table->foreignId('vehicle_id')->nullable()->constrained('vehicles')->nullOnDelete();
            $table->string('expense_number');
            $table->foreignId('expense_category_id')->nullable()->constrained('expense_categories')->nullOnDelete();
            $table->date('expense_date');
            $table->enum('expense_type', [
                'fuel', 'service', 'repair', 'insurance', 'revenue_licence', 'emission_test',
                'tyres', 'cleaning', 'parking', 'fine', 'other',
            ])->default('other');
            $table->unsignedInteger('odometer_reading')->nullable();
            // Free text rather than a vendor_id FK - most running costs
            // (fuel, parking, fines) aren't paid to a tracked supplier.
            $table->string('vendor_name')->nullable();
            $table->string('description')->nullable();

            $table->decimal('subtotal', 12, 2)->default(0);
            $table->decimal('tax_rate', 5, 2)->default(0);
            $table->decimal('tax_amount', 12, 2)->default(0);
            $table->decimal('total', 12, 2)->default(0);

            $table->string('payment_method')->nullable();
            $table->string('reference_no')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['shop_id', 'expense_number']);
            $table->index(['shop_id', 'expense_date']);
            $table->index('vehicle_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('expenses');
    }
};
