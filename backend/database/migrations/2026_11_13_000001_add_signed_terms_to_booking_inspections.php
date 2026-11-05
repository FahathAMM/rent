<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Each shop writes its own terms & conditions (shop_settings.agreement_terms).
 * At handover the customer signs on screen: the handover inspection keeps the
 * exact terms they agreed to, when, and the signature image
 * (customer_signature_path, already there). See RentalAgreementService.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('booking_inspections', function (Blueprint $table) {
            $table->text('terms_snapshot')->nullable()->after('customer_signature_path');
            $table->timestamp('terms_accepted_at')->nullable()->after('terms_snapshot');
        });
    }

    public function down(): void
    {
        Schema::table('booking_inspections', function (Blueprint $table) {
            $table->dropColumn(['terms_snapshot', 'terms_accepted_at']);
        });
    }
};
