<?php

namespace App\Services;

use App\Models\Administration\AuditLog;
use App\Models\Administration\User;
use App\Models\Booking;
use App\Models\Customer;
use App\Models\Dispute;
use App\Models\Payment;
use App\Models\Review;
use App\Models\SystemAdmin;
use App\Support\VendorContext;
use Illuminate\Support\Facades\DB;

class AuditService
{
    public static function view(string $form, ?int $recordId, string $record = ''): AuditLog
    {
        return self::log('view', $form, $recordId, $record);
    }

    public static function create(string $form, ?int $recordId, string $record, ?array $new = null): AuditLog
    {
        return self::log('create', $form, $recordId, $record, null, $new);
    }

    public static function edit(string $form, ?int $recordId, string $record, ?array $old = null, ?array $new = null): AuditLog
    {
        return self::log('edit', $form, $recordId, $record, $old, $new);
    }

    public static function delete(string $form, ?int $recordId, string $record, ?array $old = null): AuditLog
    {
        return self::log('delete', $form, $recordId, $record, $old);
    }

    /**
     * A marketplace user signing in. No guard has authenticated the request
     * yet at this point, so the user is named explicitly; the row lands on
     * their shop's log (if they have one) like any other action of theirs.
     */
    public static function login(User $user): AuditLog
    {
        return self::write('login', 'Account', $user->id, $user->email, actorUserId: $user->id, shopId: $user->shop_id);
    }

    /** A marketplace user signing out (their own session only). */
    public static function logout(User $user): AuditLog
    {
        return self::write('logout', 'Account', $user->id, $user->email, actorUserId: $user->id, shopId: $user->shop_id);
    }

    /**
     * Attributes actions to the marketplace user, customer, or platform
     * admin guard that authenticated the request.
     */
    private static function log(string $action, string $form, ?int $recordId, string $record, ?array $old = null, ?array $new = null): AuditLog
    {
        // Check the model type, not just the guard: Sanctum guards fall back to the session
        // guard, so a vendor user can come back from auth('platform') / auth('customer').
        $admin = auth('platform')->user();
        $admin = $admin instanceof SystemAdmin ? $admin : null;
        $customer = auth('customer')->user();
        $customer = $customer instanceof Customer ? $customer : null;

        return self::write(
            $action, $form, $recordId, $record, $old, $new,
            actorUserId: ($admin || $customer) ? null : AuthUser::id(),
            customerId: $customer?->id,
            adminId: $admin?->id,
            shopId: $admin ? null : self::shopId($form, $recordId, $customer !== null),
        );
    }

    private static function write(
        string $action, string $form, ?int $recordId, string $record, ?array $old = null, ?array $new = null,
        ?int $actorUserId = null, ?int $customerId = null, ?int $adminId = null, ?int $shopId = null,
    ): AuditLog {
        return AuditLog::create([
            'user_id'         => $actorUserId,
            'customer_id'     => $customerId,
            'system_admin_id' => $adminId,
            'shop_id'         => $shopId,
            'action'          => $action,
            'form'            => $form,
            'record_id'       => $recordId,
            'record'          => $record,
            'before'          => $old,
            'after'           => $new,
            'ip'              => request()->ip(),
            'browser'         => self::detectBrowser(request()->header('User-Agent')),
        ]);
    }

    /**
     * The shop the entry belongs to, so it shows on that shop's own audit
     * log (/vendor/audit-logs). Shop staff: the shop they act for. A
     * customer: the shop of the booking the record hangs off. Platform
     * admin actions stay untagged - they're on the platform audit log only.
     */
    private static function shopId(string $form, ?int $recordId, bool $byCustomer): ?int
    {
        if (!$byCustomer) {
            return VendorContext::shopId() ?? AuthUser::user()?->shop_id;
        }
        if ($recordId === null) {
            return null;
        }

        $bookingId = match ($form) {
            'Booking' => $recordId,
            'Payment' => Payment::whereKey($recordId)->value('booking_id'),
            'Dispute' => Dispute::whereKey($recordId)->value('booking_id'),
            'Review' => Review::whereKey($recordId)->value('booking_id'),
            default => null,
        };

        // Plain query builder: reads one column and skips Booking's shop scope without
        // withoutGlobalScopes() (that is reserved for App\Queries\Public* — PublicScopeBoundaryTest).
        return $bookingId ? DB::table('bookings')->where('id', $bookingId)->value('shop_id') : null;
    }

    private static function detectBrowser(?string $userAgent): ?string
    {
        if (!$userAgent) {
            return null;
        }

        if (preg_match('/(MSIE|Trident|Firefox|Chrome|Safari|Opera|Edge)/i', $userAgent, $matches)) {
            return $matches[0];
        }

        return null;
    }
}
