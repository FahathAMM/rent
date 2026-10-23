<?php

namespace App\Models\Concerns;

use App\Models\Company;
use App\Models\Scopes\CompanyScope;
use App\Support\Tenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Marks a model as tenant-owned: every query is scoped to the current
 * company (CompanyScope) and company_id is stamped automatically on create
 * from the authenticated user's tenant — a company_id passed in from the
 * frontend is always ignored in favour of it.
 */
trait BelongsToCompany
{
    public static function bootBelongsToCompany(): void
    {
        static::addGlobalScope(new CompanyScope);

        static::creating(function (Model $model) {
            if (!Tenant::hasContext()) {
                // Trusted context (console/seeder with
                // no pinned tenant): respect an explicitly-set company_id
                // instead of forcing it, since there may be no tenant to force.
                return;
            }

            // A normal tenant user: always the authenticated user's own
            // company, regardless of any company_id the request tried to set.
            $model->company_id = Tenant::id();
        });
    }

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }
}
