<?php

namespace App\Services;

use App\Models\Administration\User;
use App\Models\Company;
use App\Models\Customer;
use App\Models\Invoice;
use App\Models\Plan;
use App\Models\Subscription;
use Illuminate\Validation\ValidationException;

class SubscriptionService
{
    /** Resource key => Plan column that caps it. */
    private const LIMIT_FIELD = [
        'users'     => 'max_users',
        'customers' => 'max_customers',
        'invoices'  => 'max_invoices',
    ];

    /** Resource key => tenant-scoped model that counts current usage. */
    private const COUNT_MODEL = [
        'users'     => User::class,
        'customers' => Customer::class,
        'invoices'  => Invoice::class,
    ];

    /**
     * Resources counted against the plan limit for the current calendar
     * month only, instead of the tenant's all-time total. Users/customers
     * are "how big is your business" caps (naturally cumulative); invoices
     * are a recurring transactional volume, so a lifetime cap would
     * eventually lock out every customer permanently regardless of tenure.
     */
    private const MONTHLY_RESOURCES = ['invoices'];

    /** Usage count for one resource, scoped to the current month when that resource resets monthly. */
    private function usageCount(string $resource): int
    {
        $query = self::COUNT_MODEL[$resource]::query();

        if (in_array($resource, self::MONTHLY_RESOURCES, true)) {
            $query->where('created_at', '>=', now()->startOfMonth());
        }

        return $query->count();
    }

    /** The company's most recent subscription of any status, lazily flipping an expired trial to `expired`. */
    private function latestSubscription(Company $company): ?Subscription
    {
        $subscription = $company->subscriptions()->with('plan')->orderByDesc('id')->first();

        if ($subscription?->status === 'trial' && $subscription->trial_ends_at?->isPast()) {
            $subscription->update(['status' => 'expired']);
        }

        return $subscription;
    }

    /** The subscription currently in good standing (trial or active) — null once it's expired/cancelled/past due, or if there never was one. */
    public function current(Company $company): ?Subscription
    {
        $subscription = $this->latestSubscription($company);

        return $subscription && in_array($subscription->status, ['trial', 'active']) ? $subscription : null;
    }

    /**
     * True once a company's most recent subscription is no longer in good
     * standing (expired trial, cancelled, past due). A company with no
     * subscription row at all is never blocked by this — every real signup
     * gets one at registration (see AuthService::register), so a missing row
     * means there's nothing yet to enforce rather than something to lock out.
     */
    public function isBlocked(Company $company): bool
    {
        $subscription = $this->latestSubscription($company);

        return $subscription !== null && !in_array($subscription->status, ['trial', 'active']);
    }

    /**
     * Whether the company's current plan includes the given module (e.g.
     * 'accounting'). No plan / no active subscription is never blocked here —
     * that's `isBlocked()`'s job (enforced separately by
     * CheckSubscriptionStatus), not a reason to also hide modules.
     */
    public function hasModule(Company $company, string $module): bool
    {
        $plan = $this->current($company)?->plan;

        return !in_array($module, $plan?->disabled_modules ?? [], true);
    }

    /** Current usage vs. plan limits for every capped resource — null limit means unlimited. */
    public function usage(Company $company): array
    {
        $plan = $this->current($company)?->plan;

        $usage = [];

        foreach (array_keys(self::COUNT_MODEL) as $key) {
            $usage[$key] = [
                'used'  => $this->usageCount($key),
                'limit' => $plan?->{self::LIMIT_FIELD[$key]},
            ];
        }

        return $usage;
    }

    /**
     * Blocks creating another {$resource} once the plan's cap is reached.
     * No plan / no limit set (null) means unlimited — nothing to assert.
     */
    public function assertWithinLimit(Company $company, string $resource): void
    {
        $plan = $this->current($company)?->plan;
        $limit = $plan?->{self::LIMIT_FIELD[$resource]};

        if ($limit === null) {
            return;
        }

        $used = $this->usageCount($resource);

        if ($used >= $limit) {
            $period = in_array($resource, self::MONTHLY_RESOURCES, true) ? ' this month' : '';

            throw ValidationException::withMessages([
                $resource => ["Your {$plan->name} plan allows up to {$limit} {$resource}{$period}. Upgrade your plan to add more."],
            ]);
        }
    }

    /** Switches the company onto a new plan, ending whatever subscription it had. */
    public function changePlan(Company $company, Plan $plan): Subscription
    {
        $company->activeSubscription?->update(['status' => 'cancelled', 'ends_at' => now()]);

        return Subscription::create([
            'company_id'    => $company->id,
            'plan_id'       => $plan->id,
            'status'        => 'active',
            'starts_at'     => now(),
            'trial_ends_at' => null,
            'ends_at'       => null,
        ]);
    }

    public function cancel(Company $company): ?Subscription
    {
        $subscription = $company->activeSubscription;
        $subscription?->update(['status' => 'cancelled', 'ends_at' => now()]);

        return $subscription;
    }
}
