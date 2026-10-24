<?php

namespace App\Services;

use App\Models\ListingModerationHistory;
use App\Models\SystemAdmin;
use App\Models\Vehicle;
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

        $from = $vehicle->status;
        $vehicle->update(['status' => Vehicle::STATUS_UNPUBLISHED]);
        $this->history($admin, $vehicle, $from, Vehicle::STATUS_UNPUBLISHED, 'unpublished', $reason);

        AuditService::edit('Vehicle', $vehicle->id, $vehicle->title, null, ['status' => 'unpublished', 'reason' => $reason, 'decided_by_admin_id' => $admin->id]);

        return $vehicle->fresh();
    }

    public function feature(SystemAdmin $admin, Vehicle $vehicle, int $days = 30): Vehicle
    {
        $vehicle->update(['is_featured' => true, 'featured_until' => now()->addDays($days)]);
        $this->history($admin, $vehicle, 'not_featured', 'featured', 'featured');

        AuditService::edit('Vehicle', $vehicle->id, $vehicle->title, null, ['is_featured' => true, 'decided_by_admin_id' => $admin->id]);

        return $vehicle->fresh();
    }

    public function unfeature(SystemAdmin $admin, Vehicle $vehicle): Vehicle
    {
        $vehicle->update(['is_featured' => false, 'featured_until' => null]);
        $this->history($admin, $vehicle, 'featured', 'not_featured', 'unfeatured');

        AuditService::edit('Vehicle', $vehicle->id, $vehicle->title, null, ['is_featured' => false, 'decided_by_admin_id' => $admin->id]);

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
