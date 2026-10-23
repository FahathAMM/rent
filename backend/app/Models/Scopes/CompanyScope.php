<?php

namespace App\Models\Scopes;

use App\Support\Tenant;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Scope;

/**
 * Restricts every query on a tenant-owned model to the current company.
 * This is the enforcement point for "a user from Company A must never be
 * able to access Company B records" — it runs on every query, including
 * ones built from a raw {id} route parameter, so changing an ID in a
 * request can never leak another tenant's row.
 */
class CompanyScope implements Scope
{
    public function apply(Builder $builder, Model $model): void
    {
        if (Tenant::isPlatformAdmin()) {
            return;
        }

        if (!Tenant::hasContext()) {
            // Trusted internal context (console/queue/seeder) with no explicit
            // tenant pinned — left unrestricted by design.
            return;
        }

        $companyId = Tenant::id();

        if ($companyId === null) {
            // Authenticated but has no company (shouldn't happen for a
            // tenant-scoped request) — deny rather than risk leaking rows.
            $builder->whereRaw('1 = 0');
            return;
        }

        $builder->where($model->getTable() . '.company_id', $companyId);
    }
}
