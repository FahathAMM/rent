<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Route;
use Tests\TestCase;

/**
 * ledger_entries is the append-only financial ledger - see
 * app-doc/marketplace/02-data-model.md "ledger_entries": "No updated_at,
 * no soft delete, and no update/delete route is ever exposed on this
 * table; corrections are new reversing entries." The model itself has no
 * $timestamps update tracking (created_at only). This asserts the route
 * table side of that promise now, as a trip-wire for whichever later
 * phase adds a ledger controller.
 */
class LedgerImmutabilityTest extends TestCase
{
    public function test_no_route_can_update_or_delete_a_ledger_entry(): void
    {
        $mutating = collect(Route::getRoutes())->filter(function ($route) {
            $uri = $route->uri();
            $methods = $route->methods();

            return str_contains($uri, 'ledger')
                && array_intersect(['PUT', 'PATCH', 'DELETE'], $methods) !== [];
        });

        $this->assertCount(0, $mutating, 'A route was found that could mutate or delete a ledger_entries row.');
    }
}
