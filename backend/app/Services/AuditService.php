<?php

namespace App\Services;

use App\Models\Administration\AuditLog;

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
     * Attributes actions to the marketplace user, customer, or platform
     * admin guard that authenticated the request.
     */
    private static function log(string $action, string $form, ?int $recordId, string $record, ?array $old = null, ?array $new = null): AuditLog
    {
        $admin = auth('platform')->check() ? auth('platform')->user() : null;
        $customer = auth('customer')->user();

        return AuditLog::create([
            'user_id'         => ($admin || $customer) ? null : AuthUser::id(),
            'customer_id'     => $customer?->id,
            'system_admin_id' => $admin?->id,
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
