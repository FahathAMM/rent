<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('action'); // create, update, delete
            $table->string('form'); // controller/module name, e.g. "User"
            $table->unsignedBigInteger('record_id')->nullable();
            $table->string('record')->nullable(); // record name/label, e.g. "John Doe"
            $table->string('ip', 45)->nullable();
            $table->string('browser')->nullable();
            $table->timestamps();

            $table->index(['form', 'record_id']);
            $table->index('user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
    }
};
