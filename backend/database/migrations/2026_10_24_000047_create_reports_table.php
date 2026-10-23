<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Abuse / fraud reporting against any reportable entity. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('reports', function (Blueprint $table) {
            $table->id();
            $table->string('reportable_type');
            $table->unsignedBigInteger('reportable_id');
            $table->foreignId('reported_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('reporter_email')->nullable();

            $table->enum('reason', [
                'fraud', 'fake_listing', 'duplicate_listing', 'inappropriate_content', 'spam',
                'unsafe_vehicle', 'misleading_price', 'harassment', 'other',
            ]);
            $table->text('description')->nullable();

            $table->enum('status', ['new', 'reviewing', 'actioned', 'dismissed'])->default('new');
            $table->foreignId('reviewed_by')->nullable()->constrained('system_admins')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->string('action_taken')->nullable();
            $table->text('internal_note')->nullable();

            $table->timestamps();

            $table->index(['reportable_type', 'reportable_id']);
            $table->index(['status', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reports');
    }
};
