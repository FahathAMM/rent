<?php

namespace App\Providers;

use App\Models\Expense;
use App\Models\OwnerProfile;
use App\Models\RentalShop;
use App\Models\Vehicle;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        // Short, stable aliases for polymorphic relations (Attachment.attachable)
        // instead of leaking full namespaced class strings into the database and
        // API. Extended as new modules land.
        // Not enforced: Spatie's own model_has_roles/model_has_permissions
        // polymorphic pivots resolve User's morph class through this same
        // map, and User is intentionally not in it.
        Relation::morphMap([
            'expense' => Expense::class,
            'owner_profile' => OwnerProfile::class,
            'rental_shop' => RentalShop::class,
            'vehicle' => Vehicle::class,
        ]);
    }
}
