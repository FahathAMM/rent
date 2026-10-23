<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('plans', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->decimal('monthly_price', 15, 2)->default(0);
            $table->decimal('yearly_price', 15, 2)->nullable();
            $table->unsignedInteger('max_users')->nullable();
            $table->unsignedInteger('max_customers')->nullable();
            $table->unsignedInteger('max_invoices')->nullable();
            $table->unsignedInteger('trial_days')->default(14);
            $table->enum('status', ['active', 'inactive'])->default('active');
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('plans');
    }
};
