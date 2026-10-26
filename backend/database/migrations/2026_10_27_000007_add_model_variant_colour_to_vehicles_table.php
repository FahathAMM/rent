<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Links a vehicle to the managed model / variant / colour lists. Nullable
 * so older rows and fixtures stay valid - the vendor form requires a model.
 * The existing model/variant/colour string columns stay, filled from these
 * by VehicleRepo, so search and every display keep working.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vehicles', function (Blueprint $table) {
            $table->foreignId('model_id')->nullable()->after('brand_id')->constrained('vehicle_models')->restrictOnDelete();
            $table->foreignId('variant_id')->nullable()->after('model_id')->constrained('vehicle_variants')->nullOnDelete();
            $table->foreignId('colour_id')->nullable()->after('variant_id')->constrained('vehicle_colours')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('vehicles', function (Blueprint $table) {
            $table->dropConstrainedForeignId('colour_id');
            $table->dropConstrainedForeignId('variant_id');
            $table->dropConstrainedForeignId('model_id');
        });
    }
};
