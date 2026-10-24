<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;

/**
 * One flexible notification class instead of a dozen near-identical
 * ones - every call site supplies its own $type/$title/$body/$actionUrl,
 * and the frontend keys off `data.type` for icon/routing. Database-only
 * for now (see app-doc/marketplace/04-lifecycles.md open question #5:
 * "channel abstraction now, database + mail implemented, SMS driver
 * pluggable" - mail and SMS land when a real provider is chosen).
 *
 * Does NOT implement ShouldQueue: QUEUE_CONNECTION=database in this
 * app's .env needs a running `queue:work` process to drain jobs, which
 * nothing in this dev setup starts - a queued notification would sit
 * forever instead of ever reaching the notifications table. Dispatched
 * synchronously until a real queue worker is part of the deployment.
 */
class MarketplaceNotification extends Notification
{
    use Queueable;

    public function __construct(
        private string $type,
        private string $title,
        private string $body,
        private ?string $actionUrl = null,
        private array $meta = [],
    ) {}

    public function via($notifiable): array
    {
        return ['database'];
    }

    public function toArray($notifiable): array
    {
        return [
            'type' => $this->type,
            'title' => $this->title,
            'body' => $this->body,
            'action_url' => $this->actionUrl,
            'meta' => $this->meta,
        ];
    }
}
