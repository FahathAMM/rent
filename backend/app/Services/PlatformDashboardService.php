<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

/**
 * Aggregates global, cross-tenant SaaS statistics for the Platform
 * Dashboard. Every query here is intentionally a lightweight aggregate
 * (count/sum) or a small limited list — never a full table load — since
 * this runs against every company's data at once.
 */
class PlatformDashboardService
{
    public function getSummary(): array
    {
        return [
            'cards'                  => $this->cards(),
            'pending_activations'    => $this->pendingActivations(),
            'recent_companies'       => $this->recentCompanies(),
            'recent_signups'         => $this->recentSignups(),
            'subscription_overview'  => $this->subscriptionOverview(),
        ];
    }

    private function cards(): array
    {
        $companyStatusCounts = DB::table('companies')
            ->whereNull('deleted_at')
            ->select('status', DB::raw('count(*) as total'))
            ->groupBy('status')
            ->pluck('total', 'status');

        $trialCompanies = DB::table('subscriptions')
            ->where('status', 'trial')
            ->distinct()
            ->count('company_id');

        return [
            'total_companies'      => (int) $companyStatusCounts->sum(),
            'active_companies'     => (int) ($companyStatusCounts['active'] ?? 0),
            'trial_companies'      => (int) $trialCompanies,
            'pending_companies'    => (int) ($companyStatusCounts['initiate'] ?? 0),
            'suspended_companies'  => (int) ($companyStatusCounts['suspended'] ?? 0),
            'total_users'          => (int) DB::table('users')->whereNull('deleted_at')->count(),
        ];
    }

    private function recentCompanies(int $limit = 8): array
    {
        return DB::table('companies')
            ->whereNull('deleted_at')
            ->orderByDesc('created_at')
            ->limit($limit)
            ->get(['id', 'name', 'status', 'created_at'])
            ->map(fn ($row) => (array) $row)
            ->all();
    }

    /** Self-registered companies still waiting on a Platform Admin to activate them — oldest first, so the longest-waiting signup surfaces first. */
    private function pendingActivations(int $limit = 8): array
    {
        return DB::table('companies')
            ->whereNull('deleted_at')
            ->where('status', 'initiate')
            ->orderBy('created_at')
            ->limit($limit)
            ->get(['id', 'name', 'email', 'created_at'])
            ->map(fn ($row) => (array) $row)
            ->all();
    }

    private function recentSignups(int $limit = 8): array
    {
        return DB::table('users')
            ->join('companies', 'companies.id', '=', 'users.company_id')
            ->whereNull('users.deleted_at')
            ->whereNotNull('users.company_id')
            ->orderByDesc('users.created_at')
            ->limit($limit)
            ->get([
                'users.id', 'users.name', 'users.email', 'users.created_at',
                'companies.id as company_id', 'companies.name as company_name',
            ])
            ->map(fn ($row) => (array) $row)
            ->all();
    }

    private function subscriptionOverview(): array
    {
        return DB::table('subscriptions')
            ->select('status', DB::raw('count(*) as total'))
            ->groupBy('status')
            ->pluck('total', 'status')
            ->all();
    }

}
