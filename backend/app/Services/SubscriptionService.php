<?php

namespace App\Services;

use App\Models\Administration\User;
use App\Models\Attachment;
use App\Models\Location;
use App\Models\PlatformSetting;
use App\Models\RentalShop;
use App\Models\ShopSubscription;
use App\Models\SubscriptionPayment;
use App\Models\SubscriptionPlan;
use App\Models\SystemAdmin;
use App\Models\Vehicle;
use App\Models\VehicleSaleDetail;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpException;

/**
 * Shop plans — app-doc/marketplace/10-monetization.md.
 *
 * The current plan is worked out at read time from shop_subscriptions:
 *   - a trial / paid / granted period running now      → that plan ("trial" or "active");
 *   - a paid or granted period that ended within the
 *     grace days (platform setting)                    → still that plan ("grace");
 *   - otherwise                                        → "unpaid": no plan.
 * Nothing runs on a schedule when a period ends. An unpaid shop's listings
 * stay live for customers, but its vendor workspace is locked (everything
 * except the subscription endpoints — EnsureSubscriptionActive) until a
 * payment is approved or the platform grants a plan.
 */
class SubscriptionService
{
    public const PROOF_DISK = 'local';

    /** @return array{plan: SubscriptionPlan, state: string, subscription: ?ShopSubscription, ends_at: ?Carbon, grace_ends_at: ?Carbon} */
    public function current(RentalShop|int $shop): array
    {
        $shopId = $shop instanceof RentalShop ? $shop->id : $shop;
        $now = now();
        $grace = $this->graceDays();

        $running = ShopSubscription::with('plan')->where('shop_id', $shopId)
            ->where('starts_at', '<=', $now)->where('ends_at', '>', $now)
            ->orderByDesc('ends_at')->first();
        if ($running) {
            return [
                'plan' => $running->plan, 'subscription' => $running,
                'state' => $running->kind === ShopSubscription::KIND_TRIAL ? 'trial' : 'active',
                'ends_at' => $this->chainedEnd($shopId, $running), 'grace_ends_at' => null,
            ];
        }

        // Trials end straight away; paid / granted plans get the grace period.
        $lapsed = $grace > 0 ? ShopSubscription::with('plan')->where('shop_id', $shopId)
            ->where('kind', '!=', ShopSubscription::KIND_TRIAL)
            ->where('ends_at', '<=', $now)->where('ends_at', '>', $now->copy()->subDays($grace))
            ->orderByDesc('ends_at')->first() : null;
        if ($lapsed) {
            return [
                'plan' => $lapsed->plan, 'subscription' => $lapsed, 'state' => 'grace',
                'ends_at' => $lapsed->ends_at, 'grace_ends_at' => $lapsed->ends_at->copy()->addDays($grace),
            ];
        }

        return ['plan' => SubscriptionPlan::none(), 'subscription' => null, 'state' => 'unpaid', 'ends_at' => null, 'grace_ends_at' => null];
    }

    /** A renewal of the same plan is queued right after the current period — follow those to the real end date. */
    private function chainedEnd(int $shopId, ShopSubscription $from): Carbon
    {
        $end = $from->ends_at->copy();
        for ($i = 0; $i < 100; $i++) {
            $next = ShopSubscription::where('shop_id', $shopId)->where('plan_id', $from->plan_id)
                ->where('starts_at', '<=', $end)->where('ends_at', '>', $end)
                ->orderByDesc('ends_at')->first();
            if (!$next) {
                break;
            }
            $end = $next->ends_at->copy();
        }

        return $end;
    }

    public function plan(RentalShop|int $shop): SubscriptionPlan
    {
        return $this->current($shop)['plan'];
    }

    /** No plan running (trial and grace over, or never paid) — the vendor workspace is locked. */
    public function isLocked(RentalShop|int $shop): bool
    {
        return $this->current($shop)['state'] === 'unpaid';
    }

    public function hasFeature(RentalShop|int $shop, string $feature): bool
    {
        return $this->plan($shop)->hasFeature($feature);
    }

    /** What the shop has now, per limit. */
    public function usage(int $shopId): array
    {
        $ownerId = RentalShop::whereKey($shopId)->value('owner_user_id');

        return [
            'vehicles' => Vehicle::forRent()->where('shop_id', $shopId)->where('status', '!=', Vehicle::STATUS_ARCHIVED)->count(),
            'published_vehicles' => Vehicle::forRent()->where('shop_id', $shopId)->where('status', Vehicle::STATUS_PUBLISHED)->count(),
            // A sold car stops counting, so selling frees the slot.
            'sale_listings' => Vehicle::forSale()->where('shop_id', $shopId)->where('status', '!=', Vehicle::STATUS_ARCHIVED)
                ->whereDoesntHave('saleDetail', fn ($q) => $q->where('sale_status', VehicleSaleDetail::STATUS_SOLD))->count(),
            'staff' => User::where('shop_id', $shopId)->where('id', '!=', $ownerId)->count(),
            'locations' => Location::where('shop_id', $shopId)->count(),
        ];
    }

    /**
     * Refuse adding one more of `$limit` when the plan's limit is already reached.
     * `$current` is how many the shop has that count toward it.
     */
    public function ensureCanAdd(int $shopId, string $limit, int $current, string $what): void
    {
        $plan = $this->plan($shopId);
        $max = $plan->limit($limit);
        if ($max !== null && $current >= $max) {
            throw new HttpException(403, $max === 0
                ? "Your {$plan->name} plan doesn't include {$what}. Upgrade your plan in Settings → Subscription."
                : "Your {$plan->name} plan allows {$max} {$what}. Upgrade your plan in Settings → Subscription to add more.");
        }
    }

    public function ensureCanAddVehicle(int $shopId): void
    {
        $this->ensureCanAdd($shopId, 'vehicles', $this->usage($shopId)['vehicles'], 'vehicles');
    }

    public function ensureCanPublish(Vehicle $vehicle): void
    {
        $published = Vehicle::forRent()->where('shop_id', $vehicle->shop_id)
            ->where('status', Vehicle::STATUS_PUBLISHED)->whereKeyNot($vehicle->id)->count();
        $this->ensureCanAdd($vehicle->shop_id, 'vehicles', $published, 'published vehicles');
    }

    public function ensureCanAddSaleListing(int $shopId): void
    {
        $this->ensureCanAdd($shopId, 'sale_listings', $this->usage($shopId)['sale_listings'], 'sale listings');
    }

    public function ensureCanPublishSaleListing(Vehicle $vehicle): void
    {
        $published = Vehicle::forSale()->where('shop_id', $vehicle->shop_id)
            ->where('status', Vehicle::STATUS_PUBLISHED)->whereKeyNot($vehicle->id)->count();
        $this->ensureCanAdd($vehicle->shop_id, 'sale_listings', $published, 'published sale listings');
    }

    public function ensureCanAddStaff(int $shopId): void
    {
        $this->ensureCanAdd($shopId, 'staff', $this->usage($shopId)['staff'], 'staff accounts');
    }

    public function ensureCanAddLocation(int $shopId): void
    {
        $this->ensureCanAdd($shopId, 'locations', $this->usage($shopId)['locations'], 'locations');
    }

    /** The trial a newly verified shop gets — only once. */
    public function startTrial(RentalShop $shop): ?ShopSubscription
    {
        if (ShopSubscription::where('shop_id', $shop->id)->exists()) {
            return null;
        }
        $plan = SubscriptionPlan::where('code', PlatformSetting::get('subscription_trial_plan', 'pro'))->first();
        $days = (int) PlatformSetting::get('subscription_trial_days', 30);
        if (!$plan || $days <= 0) {
            return null;
        }

        return ShopSubscription::create([
            'shop_id' => $shop->id, 'plan_id' => $plan->id, 'kind' => ShopSubscription::KIND_TRIAL,
            'starts_at' => now(), 'ends_at' => now()->addDays($days), 'note' => 'Free trial',
        ]);
    }

    /** The shop sends a transfer receipt for `$periods` periods of a paid plan. */
    public function submitPayment(RentalShop $shop, User $by, SubscriptionPlan $plan, int $periods, ?string $bankReference, UploadedFile $file): SubscriptionPayment
    {
        if (!$plan->is_active || (float) $plan->price <= 0) {
            throw ValidationException::withMessages(['plan_id' => ['This plan can\'t be paid for.']]);
        }
        if (SubscriptionPayment::where('shop_id', $shop->id)->where('status', SubscriptionPayment::STATUS_PENDING)->exists()) {
            throw ValidationException::withMessages(['plan_id' => ['A payment is already waiting for the platform to check it.']]);
        }

        $payment = DB::transaction(function () use ($shop, $by, $plan, $periods, $bankReference, $file) {
            $payment = SubscriptionPayment::create([
                'reference_no' => 'SUB-' . now()->format('ymd') . '-' . Str::upper(Str::random(5)),
                'shop_id' => $shop->id, 'plan_id' => $plan->id, 'periods' => $periods,
                'amount' => round((float) $plan->price * $periods, 2),
                'bank_reference' => $bankReference, 'status' => SubscriptionPayment::STATUS_PENDING,
                'submitted_by' => $by->id,
            ]);

            $path = $file->store("subscription-proofs/{$shop->id}", self::PROOF_DISK);
            Attachment::create([
                'shop_id' => $shop->id,
                'file_name' => $file->getClientOriginalName(),
                'file_path' => $path,
                'disk' => self::PROOF_DISK,
                'mime_type' => $file->getMimeType(),
                'file_size' => $file->getSize(),
                'checksum' => hash_file('sha256', $file->getRealPath()),
                'attachable_type' => SubscriptionPayment::class,
                'attachable_id' => $payment->id,
                'document_type' => 'subscription_proof',
                'visibility' => 'restricted',
            ]);

            return $payment;
        });

        PlatformNotifier::notify(
            'subscription_payment_submitted',
            'Subscription payment to check',
            "{$shop->name} paid for {$plan->name} ({$payment->reference_no}). Check the transfer receipt.",
            '/platform/subscriptions',
            ['shop_id' => $shop->id, 'payment_id' => $payment->id],
        );

        return $payment;
    }

    /** Platform admin confirms the money arrived → the plan starts (or extends). */
    public function approvePayment(SystemAdmin $admin, SubscriptionPayment $payment): SubscriptionPayment
    {
        $this->ensurePending($payment);

        DB::transaction(function () use ($admin, $payment) {
            $subscription = $this->grant(
                $payment->shop_id, $payment->plan, $payment->plan->period_days * $payment->periods,
                ShopSubscription::KIND_PAID, "Payment {$payment->reference_no}", $admin->id,
            );
            $payment->update([
                'status' => SubscriptionPayment::STATUS_APPROVED, 'reviewed_by' => $admin->id, 'reviewed_at' => now(),
                'shop_subscription_id' => $subscription->id,
            ]);
        });

        AuditService::edit('SubscriptionPayment', $payment->id, $payment->reference_no, null, ['status' => 'approved', 'admin_id' => $admin->id]);

        return $payment->fresh(['plan', 'subscription']);
    }

    public function rejectPayment(SystemAdmin $admin, SubscriptionPayment $payment, string $reason): SubscriptionPayment
    {
        $this->ensurePending($payment);
        $payment->update([
            'status' => SubscriptionPayment::STATUS_REJECTED, 'reviewed_by' => $admin->id, 'reviewed_at' => now(), 'reject_reason' => $reason,
        ]);
        AuditService::edit('SubscriptionPayment', $payment->id, $payment->reference_no, null, ['status' => 'rejected', 'admin_id' => $admin->id]);

        return $payment->fresh('plan');
    }

    /**
     * Give a shop `$days` of a plan. The same plan carries on from the end of
     * the current (or grace) period; a different plan starts now and cuts the
     * current one short — no proration.
     */
    public function grant(int $shopId, SubscriptionPlan $plan, int $days, string $kind, ?string $note, ?int $adminId): ShopSubscription
    {
        $current = $this->current($shopId);
        $start = now();

        if ($current['subscription'] && $current['state'] !== 'unpaid') {
            if ($current['plan']->id === $plan->id && $current['state'] !== 'grace') {
                $start = $current['ends_at']->copy();
            } else {
                // Switching plan: queued periods are dropped, the running one ends now.
                ShopSubscription::where('shop_id', $shopId)->where('starts_at', '>', $start)->delete();
                ShopSubscription::where('shop_id', $shopId)->where('ends_at', '>', $start)->update(['ends_at' => $start]);
            }
        }

        return ShopSubscription::create([
            'shop_id' => $shopId, 'plan_id' => $plan->id, 'kind' => $kind,
            'starts_at' => $start, 'ends_at' => $start->copy()->addDays($days), 'note' => $note, 'created_by' => $adminId,
        ]);
    }

    /**
     * Platform "Grant plan": make `$plan` run until `$endsAt`.
     *
     *  - Same plan as the one running now (trial or paid): a later date adds
     *    the days after the current end (a trial stays a trial); an earlier
     *    date shortens it — queued renewals after that date are dropped.
     *  - A different plan, or a shop in grace / unpaid: the plan starts now and
     *    runs to `$endsAt`; whatever was running ends now. No proration.
     *    `$asTrial` saves it as a free trial (trial label, no grace afterwards)
     *    instead of a grant.
     *
     * @return array{subscription: ShopSubscription, change: string, days: int} change = extended | reduced | unchanged | started
     */
    public function setPlanUntil(int $shopId, SubscriptionPlan $plan, Carbon $endsAt, ?string $note, ?int $adminId, bool $asTrial = false): array
    {
        $current = $this->current($shopId);
        $now = now();

        return DB::transaction(function () use ($shopId, $plan, $endsAt, $note, $adminId, $current, $now, $asTrial) {
            $samePlan = in_array($current['state'], ['trial', 'active'], true) && $current['plan']->id === $plan->id;

            if ($samePlan) {
                $end = $current['ends_at'];
                $days = (int) round($end->diffInHours($endsAt, false) / 24);

                if ($endsAt->greaterThan($end)) {
                    $subscription = ShopSubscription::create([
                        'shop_id' => $shopId, 'plan_id' => $plan->id,
                        'kind' => $current['subscription']->kind === ShopSubscription::KIND_TRIAL ? ShopSubscription::KIND_TRIAL : ShopSubscription::KIND_GRANTED,
                        'starts_at' => $end, 'ends_at' => $endsAt, 'note' => $note ?? 'Extended by the platform', 'created_by' => $adminId,
                    ]);
                    $change = 'extended';
                } elseif ($endsAt->lessThan($end)) {
                    ShopSubscription::where('shop_id', $shopId)->where('starts_at', '>=', $endsAt)->delete();
                    ShopSubscription::where('shop_id', $shopId)->where('ends_at', '>', $endsAt)->update(['ends_at' => $endsAt]);
                    $subscription = $current['subscription']->fresh();
                    $change = 'reduced';
                } else {
                    $subscription = $current['subscription'];
                    $change = 'unchanged';
                }

                AuditService::edit('ShopSubscription', $subscription->id, $plan->name, ['ends_at' => $end->toIso8601String()], ['ends_at' => $endsAt->toIso8601String(), 'change' => $change, 'note' => $note, 'admin_id' => $adminId]);

                return ['subscription' => $subscription, 'change' => $change, 'days' => $days];
            }

            // Different plan / grace / unpaid: starts now, the running period (and anything queued) ends now.
            ShopSubscription::where('shop_id', $shopId)->where('starts_at', '>', $now)->delete();
            ShopSubscription::where('shop_id', $shopId)->where('ends_at', '>', $now)->update(['ends_at' => $now]);
            $subscription = ShopSubscription::create([
                'shop_id' => $shopId, 'plan_id' => $plan->id,
                'kind' => $asTrial ? ShopSubscription::KIND_TRIAL : ShopSubscription::KIND_GRANTED,
                'starts_at' => $now, 'ends_at' => $endsAt,
                'note' => $note ?? ($asTrial ? 'Free trial given by the platform' : 'Granted by the platform'), 'created_by' => $adminId,
            ]);
            AuditService::edit('ShopSubscription', $subscription->id, $plan->name, null, ['ends_at' => $endsAt->toIso8601String(), 'change' => 'started', 'kind' => $subscription->kind, 'note' => $note, 'admin_id' => $adminId]);

            return ['subscription' => $subscription, 'change' => 'started', 'days' => (int) round($now->diffInHours($endsAt) / 24)];
        });
    }

    /** Everything the vendor app needs: plan, state, dates, limits, usage and features. */
    public function summary(int $shopId): array
    {
        $current = $this->current($shopId);
        $plan = $current['plan'];
        $end = $current['grace_ends_at'] ?? $current['ends_at'];

        return [
            'plan' => $this->presentPlan($plan),
            'state' => $current['state'],
            'locked' => $current['state'] === 'unpaid',
            'ends_at' => $current['ends_at']?->toIso8601String(),
            'grace_ends_at' => $current['grace_ends_at']?->toIso8601String(),
            'days_left' => $end ? max(0, (int) ceil(now()->diffInHours($end, false) / 24)) : null,
            'usage' => $this->usage($shopId),
            'features' => array_values($plan->features ?? []),
        ];
    }

    public function presentPlan(SubscriptionPlan $plan): array
    {
        return [
            'id' => $plan->id, 'code' => $plan->code, 'name' => $plan->name, 'description' => $plan->description,
            'price' => (float) $plan->price, 'period_days' => $plan->period_days,
            'max_vehicles' => $plan->max_vehicles, 'max_sale_listings' => $plan->max_sale_listings, 'max_staff' => $plan->max_staff, 'max_locations' => $plan->max_locations,
            'features' => array_values($plan->features ?? []), 'is_active' => (bool) $plan->is_active, 'sort_order' => $plan->sort_order,
        ];
    }

    public function graceDays(): int
    {
        return max(0, (int) PlatformSetting::get('subscription_grace_days', 7));
    }

    public function bankDetails(): array
    {
        return (array) PlatformSetting::get('subscription_bank_details', []);
    }

    private function ensurePending(SubscriptionPayment $payment): void
    {
        if ($payment->status !== SubscriptionPayment::STATUS_PENDING) {
            throw ValidationException::withMessages(['status' => ['This payment has already been reviewed.']]);
        }
    }
}
