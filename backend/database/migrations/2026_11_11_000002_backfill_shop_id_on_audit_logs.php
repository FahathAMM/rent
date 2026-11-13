<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * AuditService didn't record shop_id until now, so the shop's own audit log
 * (/vendor/audit-logs, filtered by shop_id) showed nothing. Fill it in for
 * existing entries: shop staff from their user's shop, customers from the
 * shop of the booking the record belongs to. Platform admin entries stay
 * untagged. Data-only - nothing to undo.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Shop staff.
        DB::statement('
            UPDATE audit_logs SET shop_id = (SELECT users.shop_id FROM users WHERE users.id = audit_logs.user_id)
            WHERE shop_id IS NULL AND system_admin_id IS NULL AND user_id IS NOT NULL
        ');

        // Customers: the shop of the booking behind the record.
        $bookingOf = [
            'Booking' => 'SELECT bookings.shop_id FROM bookings WHERE bookings.id = audit_logs.record_id',
            'Payment' => 'SELECT bookings.shop_id FROM payments JOIN bookings ON bookings.id = payments.booking_id WHERE payments.id = audit_logs.record_id',
            'Dispute' => 'SELECT bookings.shop_id FROM disputes JOIN bookings ON bookings.id = disputes.booking_id WHERE disputes.id = audit_logs.record_id',
            'Review' => 'SELECT reviews.shop_id FROM reviews WHERE reviews.id = audit_logs.record_id',
        ];

        foreach ($bookingOf as $form => $select) {
            DB::statement("
                UPDATE audit_logs SET shop_id = ({$select})
                WHERE shop_id IS NULL AND customer_id IS NOT NULL AND record_id IS NOT NULL AND form = ?
            ", [$form]);
        }
    }

    public function down(): void
    {
        //
    }
};
