<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('locations', function (Blueprint $table) {
            $table->string('branch_code')->nullable()->after('name');
            $table->string('city')->nullable()->after('address');
            $table->string('state')->nullable()->after('city');
            $table->string('country')->nullable()->after('state');
            $table->decimal('latitude', 10, 7)->nullable()->after('country');
            $table->decimal('longitude', 10, 7)->nullable()->after('latitude');
            $table->string('phone')->nullable()->after('longitude');
            $table->string('email')->nullable()->after('phone');
            $table->string('contact_person')->nullable()->after('email');
            $table->string('working_hours')->nullable()->after('contact_person');
            $table->boolean('is_active')->default(true)->after('working_hours');

            $table->unique(['company_id', 'branch_code']);
        });
    }

    public function down(): void
    {
        Schema::table('locations', function (Blueprint $table) {
            $table->dropUnique(['company_id', 'branch_code']);
            $table->dropColumn([
                'branch_code', 'city', 'state', 'country', 'latitude', 'longitude',
                'phone', 'email', 'contact_person', 'working_hours', 'is_active',
            ]);
        });
    }
};
