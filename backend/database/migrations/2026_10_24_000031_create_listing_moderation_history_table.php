<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Append-only. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('listing_moderation_history', function (Blueprint $table) {
            $table->id();
            $table->foreignId('vehicle_id')->constrained('vehicles')->cascadeOnDelete();
            $table->string('from_status')->nullable();
            $table->string('to_status');
            $table->enum('action', [
                'submitted', 'approved', 'rejected', 'unpublished', 'republished',
                'archived', 'flagged', 'featured', 'unfeatured',
            ]);
            $table->enum('actor_type', ['owner', 'staff', 'system_admin', 'system']);
            $table->unsignedBigInteger('actor_id')->nullable();
            $table->string('reason')->nullable();
            $table->text('notes')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->index('vehicle_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('listing_moderation_history');
    }
};
