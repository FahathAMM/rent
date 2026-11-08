<?php

namespace App\Services;

use App\Models\SystemAdmin;
use App\Notifications\MarketplaceNotification;
use Illuminate\Support\Facades\Notification;

/**
 * Tells every active platform admin about something waiting for the
 * platform: a shop to verify, a subscription payment to check, a review
 * to moderate, a dispute or an abuse report. Shown by the platform
 * console's bell (Platform\NotificationController).
 */
class PlatformNotifier
{
    public static function notify(string $type, string $title, string $body, ?string $actionUrl = null, array $meta = []): void
    {
        $admins = SystemAdmin::where('is_active', true)->get();
        if ($admins->isNotEmpty()) {
            Notification::send($admins, new MarketplaceNotification($type, $title, $body, $actionUrl, $meta));
        }
    }
}
