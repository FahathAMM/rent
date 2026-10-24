<?php

namespace App\Providers;

use App\Contracts\PaymentGateway;
use App\Models\Expense;
use App\Models\OwnerProfile;
use App\Models\RentalShop;
use App\Models\Vehicle;
use App\Services\Payments\PayHereGateway;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // Swapping gateways (or adding a second one) later is a binding
        // change here, not a change to BookingController/the webhook
        // controller - see PaymentGateway's docblock.
        $this->app->bind(PaymentGateway::class, PayHereGateway::class);
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
