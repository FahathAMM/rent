<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The idempotency guard: inserting this row IS the duplicate check.
 * unique(gateway, event_id) means a repeated webhook notification hits the
 * unique key, the handler returns 200 and does nothing further - no
 * webhook is ever processed twice. See
 * app-doc/marketplace/04-lifecycles.md "Payment lifecycle".
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payment_webhook_events', function (Blueprint $table) {
            $table->id();
            $table->enum('gateway', ['payhere', 'bank_transfer', 'cash', 'manual']);
            $table->string('event_id');
            $table->string('event_type')->nullable();
            $table->boolean('signature_valid')->default(false);
            $table->json('payload');
            $table->timestamp('received_at');
            $table->enum('status', ['received', 'processed', 'ignored', 'duplicate', 'failed'])
                ->default('received');
            $table->timestamp('processed_at')->nullable();
            $table->unsignedInteger('attempts')->default(0);
            $table->string('error')->nullable();
            $table->foreignId('payment_id')->nullable()->constrained('payments')->nullOnDelete();
            $table->string('ip', 45)->nullable();
            $table->timestamps();

            $table->unique(['gateway', 'event_id']);
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_webhook_events');
    }
};
