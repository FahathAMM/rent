<?php

namespace App\Services;

use App\Models\Promotion;
use App\Models\ListingModerationHistory;
use App\Models\RentalShop;
use App\Models\SystemAdmin;
use App\Models\Vehicle;
use App\Notifications\MarketplaceNotification;
use Illuminate\Validation\ValidationException;

/**
 * Platform review of newly-submitted (or reported) listings - a vehicle's
 * moderation_status starts 'pending' at creation (VehicleRepo::store) and
 * VehicleController::publish() refuses anything but 'approved', so this
 * is the only path that unblocks an owner's listing going live. See
 * app-doc/marketplace/05-ui-and-api-map.md "/platform/listings".
 */
class ListingModerationService
{
    public function approve(SystemAdmin $admin, Vehicle $vehicle): Vehicle
    {
        $from = $vehicle->moderation_status;
        $vehicle->update(['moderation_status' => Vehicle::MODERATION_APPROVED, 'moderation_note' => null]);
        $this->history($admin, $vehicle, $from, Vehicle::MODERATION_APPROVED, 'approved');

        AuditService::edit('Vehicle', $vehicle->id, $vehicle->title, null, ['moderation_status' => 'approved', 'decided_by_admin_id' => $admin->id]);

        $vehicle->shop?->owner?->notify(new MarketplaceNotification(
            'listing_approved', 'Listing approved', "Your listing \"{$vehicle->title}\" passed moderation — you can publish it now.", '/vendor/vehicles',
        ));

        return $vehicle->fresh();
    }

    public function reject(SystemAdmin $admin, Vehicle $vehicle, string $reason): Vehicle
    {
        $from = $vehicle->moderation_status;
        $vehicle->update([
            'moderation_status' => Vehicle::MODERATION_REJECTED,
            'moderation_note' => $reason,
            'status' => Vehicle::STATUS_REJECTED,
        ]);
        $this->history($admin, $vehicle, $from, Vehicle::MODERATION_REJECTED, 'rejected', $reason);

        AuditService::edit('Vehicle', $vehicle->id, $vehicle->title, null, ['moderation_status' => 'rejected', 'reason' => $reason, 'decided_by_admin_id' => $admin->id]);

        $vehicle->shop?->owner?->notify(new MarketplaceNotification(
            'listing_rejected', 'Listing rejected', "Your listing \"{$vehicle->title}\" was rejected: {$reason}", '/vendor/vehicles',
        ));

        return $vehicle->fresh();
    }

    public function flag(SystemAdmin $admin, Vehicle $vehicle, string $reason): Vehicle
    {
        $from = $vehicle->moderation_status;
        $vehicle->update(['moderation_status' => Vehicle::MODERATION_FLAGGED, 'moderation_note' => $reason]);
        $this->history($admin, $vehicle, $from, Vehicle::MODERATION_FLAGGED, 'flagged', $reason);

        AuditService::edit('Vehicle', $vehicle->id, $vehicle->title, null, ['moderation_status' => 'flagged', 'reason' => $reason, 'decided_by_admin_id' => $admin->id]);

        return $vehicle->fresh();
    }

    public function unpublish(SystemAdmin $admin, Vehicle $vehicle, ?string $reason = null): Vehicle
    {
        if ($vehicle->status !== Vehicle::STATUS_PUBLISHED) {
            throw ValidationException::withMessages(['status' => ['Only a published listing can be unpublished.']]);
        }

        // Also flag it: an approved listing could otherwise be republished by
        // the shop straight away (VehicleController::publish only checks
        // moderation), undoing the takedown. Only republish() lifts this.
        $from = $vehicle->status;
        $vehicle->update([
            'status' => Vehicle::STATUS_UNPUBLISHED,
            'moderation_status' => Vehicle::MODERATION_FLAGGED,
            'moderation_note' => $reason ?: 'Unpublished by the platform.',
        ]);
        $this->history($admin, $vehicle, $from, Vehicle::STATUS_UNPUBLISHED, 'unpublished', $reason);

        AuditService::edit('Vehicle', $vehicle->id, $vehicle->title, null, ['status' => 'unpublished', 'moderation_status' => 'flagged', 'reason' => $reason, 'decided_by_admin_id' => $admin->id]);

        $vehicle->shop?->owner?->notify(new MarketplaceNotification(
            'listing_unpublished', 'Listing taken offline', "Your listing \"{$vehicle->title}\" was taken offline by the platform" . ($reason ? ": {$reason}" : '.'), '/vendor/vehicles',
        ));

        return $vehicle->fresh();
    }

    /** Puts a platform-unpublished listing back live — approves it and publishes it in one step. */
    public function republish(SystemAdmin $admin, Vehicle $vehicle): Vehicle
    {
        if ($vehicle->status !== Vehicle::STATUS_UNPUBLISHED) {
            throw ValidationException::withMessages(['status' => ['Only an unpublished listing can be republished.']]);
        }
        if (!$vehicle->shop?->isVerified() || $vehicle->shop->status === RentalShop::STATUS_SUSPENDED) {
            throw ValidationException::withMessages(['status' => ["The listing's shop must be verified and active before it can go live."]]);
        }

        $from = $vehicle->status;
        $vehicle->update([
            'status' => Vehicle::STATUS_PUBLISHED,
            'published_at' => now(),
            'moderation_status' => Vehicle::MODERATION_APPROVED,
            'moderation_note' => null,
        ]);
        $this->history($admin, $vehicle, $from, Vehicle::STATUS_PUBLISHED, 'republished');

        AuditService::edit('Vehicle', $vehicle->id, $vehicle->title, null, ['status' => 'published', 'moderation_status' => 'approved', 'decided_by_admin_id' => $admin->id]);

        $vehicle->shop->owner?->notify(new MarketplaceNotification(
            'listing_republished', 'Listing back online', "Your listing \"{$vehicle->title}\" is live on the marketplace again.", '/vendor/vehicles',
        ));

        return $vehicle->fresh();
    }

    /** Featuring is a promotion now — the platform grants one (respecting the featured slot limit). */
    public function feature(SystemAdmin $admin, Vehicle $vehicle, int $days = 30): Vehicle
    {
        $promotion = app(PromotionService::class)->grant($admin, $vehicle->shop, Promotion::TYPE_FEATURED, ['vehicle_id' => $vehicle->id], $days, 'Featured by the platform');
        $this->history($admin, $vehicle, 'not_featured', 'featured', 'featured',
            $promotion->starts_at->isFuture() ? 'Slots full — starts ' . $promotion->starts_at->toDateString() : null);

        return $vehicle->fresh();
    }

    public function unfeature(SystemAdmin $admin, Vehicle $vehicle): Vehicle
    {
        app(PromotionService::class)->endFeaturing($admin, $vehicle);
        $this->history($admin, $vehicle, 'featured', 'not_featured', 'unfeatured');

        return $vehicle->fresh();
    }

    private function history(SystemAdmin $admin, Vehicle $vehicle, ?string $from, string $to, string $action, ?string $reason = null): void
    {
        ListingModerationHistory::create([
            'vehicle_id' => $vehicle->id,
            'from_status' => $from,
            'to_status' => $to,
            'action' => $action,
            'actor_type' => 'system_admin',
            'actor_id' => $admin->id,
            'reason' => $reason,
        ]);
    }
}
