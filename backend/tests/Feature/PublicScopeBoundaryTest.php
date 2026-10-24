<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\File;
use Tests\TestCase;

/**
 * A structural guard, not a functional one: asserts that
 * withoutGlobalScope(ShopScope::class) is used ONLY inside
 * App\Queries\Public* or App\Queries\Customer* (see
 * app-doc/marketplace/01-phase1-architecture.md section 2.2 and
 * CustomerBookingQuery's docblock for why a second case exists: a
 * customer's own bookings span multiple shops, so shop-scoping is the
 * wrong question, and ShopScope's authenticated-but-no-context branch
 * fails closed - every customer request has no shop context at all).
 * If this ever fails, something outside those two narrow, audited
 * layers has started bypassing shop isolation.
 */
class PublicScopeBoundaryTest extends TestCase
{
    public function test_shop_scope_bypass_is_confined_to_the_public_query_layer(): void
    {
        $appPath = base_path('app');
        $offenders = [];
        $queriesPath = 'app' . DIRECTORY_SEPARATOR . 'Queries' . DIRECTORY_SEPARATOR;

        foreach (File::allFiles($appPath) as $file) {
            if ($file->getExtension() !== 'php') {
                continue;
            }

            $contents = file_get_contents($file->getPathname());

            // Matches the actual method call (->withoutGlobalScope( or
            // ::withoutGlobalScope() on a static), not prose that merely
            // mentions it in a comment.
            if (!preg_match('/(->|::)\s*withoutGlobalScope/', $contents)) {
                continue;
            }

            $relative = str_replace(base_path() . DIRECTORY_SEPARATOR, '', $file->getPathname());
            $isSanctioned = str_starts_with($relative, $queriesPath . 'Public')
                || str_starts_with($relative, $queriesPath . 'Customer');

            if (!$isSanctioned) {
                $offenders[] = $relative;
            }
        }

        $this->assertEmpty(
            $offenders,
            "withoutGlobalScope() found outside App\\Queries\\Public*/Customer*: " . implode(', ', $offenders)
        );
    }
}
