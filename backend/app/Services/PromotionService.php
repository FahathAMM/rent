<?php

namespace App\Services;

use App\Models\Administration\User;
use App\Models\Attachment;
use App\Models\PlatformSetting;
use App\Models\Promotion;
use App\Models\PromotionPackage;
use App\Models\RentalShop;
use App\Models\SystemAdmin;
use App\Models\Vehicle;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Paid visibility — app-doc/marketplace/10-monetization.md 2.2.
 *
 *  - featured  : one vehicle sorts first in search, shows in the home row and gets a badge.
 *                At most `featured_listing_slots` vehicles at a time (platform setting).
 *  - sponsored : a shop's vehicles sort first, with a "Sponsored" label, when someone searches
 *                its city. At most `sponsored_slots_per_target` shops per city at a time.
 *
 * When every slot is taken, approving (or granting) schedules the promotion to
 * start at the first moment a slot is free for its whole length — no one is
 * bumped. The same vehicle / shop never runs two at once: a second one
 * queues after the first. Live / ended is worked out from the dates on every
 * read; nothing runs on a schedule.
 */
class PromotionService
{
    public const PROOF_DISK = 'local';

    // ── Reading ──────────────────────────────────────────────────────────

    public function isFeatured(Vehicle $vehicle): bool
    {
        return Promotion::live()->where('type', Promotion::TYPE_FEATURED)->where('vehicle_id', $vehicle->id)->exists();
    }

    public function featuredSlots(): int
    {
        return max(1, (int) PlatformSetting::get('featured_listing_slots', 12));
    }

    public function sponsoredSlots(): int
    {
        return max(1, (int) PlatformSetting::get('sponsored_slots_per_target', 3));
    }

    /**
     * When a promotion of this kind and length could start — now if a slot is
     * free for the whole period, else the first moment one is (and after any
     * booked promotion for the same vehicle / shop).
     *
     * @param array{vehicle_id?: ?int, shop_id?: ?int, city?: ?string} $target
     */
    public function nextStart(string $type, array $target, int $days, ?int $ignoreId = null): Carbon
    {
        $limit = $type === Promotion::TYPE_FEATURED ? $this->featuredSlots() : $this->sponsoredSlots();

        // Everything that competes for the same slots.
        $pool = Promotion::booked()->where('type', $type)->when($ignoreId, fn ($q) => $q->whereKeyNot($ignoreId));
        if ($type === Promotion::TYPE_SPONSORED) {
            $pool->where('city', $target['city']); // slots are per city
        }
        $booked = $pool->get(['id', 'vehicle_id', 'shop_id', 'starts_at', 'ends_at']);

        // Never two at once for the same thing: start after its last booked one.
        $own = $type === Promotion::TYPE_FEATURED
            ? $booked->where('vehicle_id', $target['vehicle_id'] ?? null)
            : $booked->where('shop_id', $target['shop_id'] ?? null);
        $earliest = now()->max($own->max('ends_at') ?? now());

        $candidates = $booked->pluck('ends_at')->filter(fn ($end) => $end->greaterThan($earliest))->push($earliest)->sort()->values();
        foreach ($candidates as $start) {
            $end = $start->copy()->addDays($days);
            $overlapping = $booked->filter(fn ($p) => $p->starts_at->lessThan($end) && $p->ends_at->greaterThan($start))->count();
            if ($overlapping < $limit) {
                return $start->copy();
            }
        }

        return $candidates->last()->copy(); // unreachable in practice: the last end always frees a slot
    }

    // ── Buying (vendor) ──────────────────────────────────────────────────

    /**
     * @param array{vehicle_id?: ?int} $data  featured needs vehicle_id; sponsored uses the shop's city
     */
    public function submit(RentalShop $shop, User $by, PromotionPackage $package, array $data, ?string $bankReference, UploadedFile $file): Promotion
    {
        if (!$package->is_active) {
            throw ValidationException::withMessages(['package_id' => ['This package is no longer offered.']]);
        }
        $target = $this->resolveTarget($shop, $package->type, $data);

        $waiting = Promotion::where('shop_id', $shop->id)->where('status', Promotion::STATUS_PENDING)->where('type', $package->type)
            ->where(fn ($q) => $package->type === Promotion::TYPE_FEATURED
                ? $q->where('vehicle_id', $target['vehicle_id'])
                : $q->where('city', $target['city']))
            ->exists();
        if ($waiting) {
            throw ValidationException::withMessages(['package_id' => ['A payment for this is already waiting for the platform to check it.']]);
        }

        return DB::transaction(function () use ($shop, $by, $package, $target, $bankReference, $file) {
            $promotion = Promotion::create($target + [
                'reference_no' => $this->reference(),
                'shop_id' => $shop->id, 'package_id' => $package->id, 'type' => $package->type,
                'days' => $package->days, 'amount' => $package->price, 'kind' => Promotion::KIND_PAID,
                'status' => Promotion::STATUS_PENDING, 'bank_reference' => $bankReference, 'submitted_by' => $by->id,
            ]);

            $path = $file->store("promotion-proofs/{$shop->id}", self::PROOF_DISK);
            Attachment::create([
                'shop_id' => $shop->id,
                'file_name' => $file->getClientOriginalName(),
                'file_path' => $path,
                'disk' => self::PROOF_DISK,
                'mime_type' => $file->getMimeType(),
                'file_size' => $file->getSize(),
                'checksum' => hash_file('sha256', $file->getRealPath()),
                'attachable_type' => Promotion::class,
                'attachable_id' => $promotion->id,
                'document_type' => 'promotion_proof',
                'visibility' => 'restricted',
            ]);

            return $promotion;
        });
    }

    /**
     * What a promotion points at, checked against the shop:
     * featured → one of its published vehicles; sponsored → the shop's own city.
     *
     * @return array{vehicle_id: ?int, city: ?string}
     */
    public function resolveTarget(RentalShop $shop, string $type, array $data): array
    {
        if ($type === Promotion::TYPE_FEATURED) {
            $vehicle = Vehicle::where('shop_id', $shop->id)->find($data['vehicle_id'] ?? 0);
            if (!$vehicle || $vehicle->status !== Vehicle::STATUS_PUBLISHED || $vehicle->moderation_status !== Vehicle::MODERATION_APPROVED) {
                throw ValidationException::withMessages(['vehicle_id' => ['Pick one of your published vehicles.']]);
            }

            return ['vehicle_id' => $vehicle->id, 'city' => null];
        }

        if (!$shop->city) {
            throw ValidationException::withMessages(['city' => ['Add your city to the shop profile first.']]);
        }

        return ['vehicle_id' => null, 'city' => $shop->city];
    }

    // ── Platform ─────────────────────────────────────────────────────────

    /** Money arrived → it goes live now, or as soon as a slot is free. */
    public function approve(SystemAdmin $admin, Promotion $promotion): Promotion
    {
        if ($promotion->status !== Promotion::STATUS_PENDING) {
            throw ValidationException::withMessages(['status' => ['This payment has already been reviewed.']]);
        }

        $start = $this->nextStart($promotion->type, $promotion->only(['vehicle_id', 'shop_id', 'city']), $promotion->days, $promotion->id);
        $promotion->update([
            'status' => Promotion::STATUS_APPROVED, 'starts_at' => $start, 'ends_at' => $start->copy()->addDays($promotion->days),
            'reviewed_by' => $admin->id, 'reviewed_at' => now(),
        ]);
        AuditService::edit('Promotion', $promotion->id, $promotion->reference_no, null, ['status' => 'approved', 'starts_at' => $start->toIso8601String(), 'admin_id' => $admin->id]);

        return $promotion->fresh();
    }

    public function reject(SystemAdmin $admin, Promotion $promotion, string $reason): Promotion
    {
        if ($promotion->status !== Promotion::STATUS_PENDING) {
            throw ValidationException::withMessages(['status' => ['This payment has already been reviewed.']]);
        }
        $promotion->update(['status' => Promotion::STATUS_REJECTED, 'reviewed_by' => $admin->id, 'reviewed_at' => now(), 'reject_reason' => $reason]);
        AuditService::edit('Promotion', $promotion->id, $promotion->reference_no, null, ['status' => 'rejected', 'admin_id' => $admin->id]);

        return $promotion->fresh();
    }

    /** A free promotion from the platform (a deal, a comp, or the old "Feature" button). Respects the slot limits. */
    public function grant(SystemAdmin $admin, RentalShop $shop, string $type, array $data, int $days, ?string $note): Promotion
    {
        $target = $this->resolveTarget($shop, $type, $data);
        $start = $this->nextStart($type, $target + ['shop_id' => $shop->id], $days);

        $promotion = Promotion::create($target + [
            'reference_no' => $this->reference(), 'shop_id' => $shop->id, 'type' => $type, 'days' => $days, 'amount' => 0,
            'kind' => Promotion::KIND_GRANTED, 'status' => Promotion::STATUS_APPROVED,
            'starts_at' => $start, 'ends_at' => $start->copy()->addDays($days), 'note' => $note ?? 'Granted by the platform',
            'reviewed_by' => $admin->id, 'reviewed_at' => now(),
        ]);
        AuditService::create('Promotion', $promotion->id, $promotion->reference_no);

        return $promotion;
    }

    /** Stop a live or scheduled promotion now (no refund). */
    public function end(SystemAdmin $admin, Promotion $promotion, ?string $reason = null): Promotion
    {
        if ($promotion->status !== Promotion::STATUS_APPROVED || !$promotion->ends_at->isFuture()) {
            throw ValidationException::withMessages(['status' => ['Only a live or scheduled promotion can be ended.']]);
        }
        $now = now();
        $promotion->update([
            'starts_at' => $promotion->starts_at->isFuture() ? $now : $promotion->starts_at,
            'ends_at' => $now,
            'note' => trim(($promotion->note ? $promotion->note . ' · ' : '') . 'Ended by the platform' . ($reason ? ": {$reason}" : '')),
        ]);
        AuditService::edit('Promotion', $promotion->id, $promotion->reference_no, null, ['ended_at' => $now->toIso8601String(), 'admin_id' => $admin->id, 'reason' => $reason]);

        return $promotion->fresh();
    }

    /** End every live / scheduled featuring of a vehicle (platform "Unfeature"). */
    public function endFeaturing(SystemAdmin $admin, Vehicle $vehicle): int
    {
        $running = Promotion::booked()->where('type', Promotion::TYPE_FEATURED)->where('vehicle_id', $vehicle->id)->get();
        $running->each(fn (Promotion $p) => $this->end($admin, $p));

        return $running->count();
    }

    /** A sold car can't sell again, so its featuring stops and the slot frees up. No refund, as with an admin's End. */
    public function endForSoldVehicle(Vehicle $vehicle): void
    {
        $now = now();

        Promotion::booked()->where('type', Promotion::TYPE_FEATURED)->where('vehicle_id', $vehicle->id)->get()
            ->each(fn (Promotion $p) => $p->update([
                'starts_at' => $p->starts_at->isFuture() ? $now : $p->starts_at,
                'ends_at' => $now,
                'note' => trim(($p->note ? $p->note . ' · ' : '') . 'Ended: the vehicle was sold'),
            ]));
    }

    public function present(Promotion $p): array
    {
        return [
            'id' => $p->id, 'reference_no' => $p->reference_no, 'type' => $p->type, 'kind' => $p->kind,
            'state' => $p->state(), 'status' => $p->status,
            'target' => $p->targetLabel(), 'vehicle_id' => $p->vehicle_id, 'city' => $p->city,
            'package' => $p->package?->name, 'days' => $p->days, 'amount' => (float) $p->amount,
            'starts_at' => $p->starts_at?->toIso8601String(), 'ends_at' => $p->ends_at?->toIso8601String(),
            'bank_reference' => $p->bank_reference, 'note' => $p->note, 'reject_reason' => $p->reject_reason,
            'has_proof' => $p->relationLoaded('proof') ? (bool) $p->proof : null,
            'created_at' => $p->created_at?->toIso8601String(), 'reviewed_at' => $p->reviewed_at?->toIso8601String(),
        ];
    }

    private function reference(): string
    {
        return 'PRM-' . now()->format('ymd') . '-' . Str::upper(Str::random(5));
    }
}
