<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

/**
 * notification_preferences was never used (no model or code reads it); its
 * create migration was removed from the history, this clears it from
 * existing databases. No-op on a fresh install.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('notification_preferences');
    }

    public function down(): void
    {
        // Not recreated — nothing uses it.
    }
};
