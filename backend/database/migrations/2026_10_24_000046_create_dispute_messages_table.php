<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** is_internal messages are visible to platform admins only. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('dispute_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('dispute_id')->constrained('disputes')->cascadeOnDelete();
            $table->enum('author_type', ['customer', 'owner', 'staff', 'system_admin', 'system']);
            $table->unsignedBigInteger('author_id')->nullable();
            $table->text('message');
            $table->boolean('is_internal')->default(false);
            $table->foreignId('attachment_id')->nullable()->constrained('attachments')->nullOnDelete();
            $table->timestamp('created_at')->useCurrent();

            $table->index('dispute_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dispute_messages');
    }
};
