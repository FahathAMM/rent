<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\File;
use Tests\TestCase;

/**
 * A structural guard, not a functional one: asserts that
 * withoutGlobalScope(ShopScope::class) - the one sanctioned way to read
 * across every shop for public/anonymous consumption - is used ONLY
 * inside App\Queries\Public* (see
 * app-doc/marketplace/01-phase1-architecture.md section 2.2). If this
 * ever fails, something outside the public query layer has started
 * bypassing shop isolation, and every occurrence needs auditing.
 */
class PublicScopeBoundaryTest extends TestCase
{
    public function test_shop_scope_bypass_is_confined_to_the_public_query_layer(): void
    {
        $appPath = base_path('app');
        $offenders = [];

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
            $isSanctioned = str_starts_with($relative, 'app' . DIRECTORY_SEPARATOR . 'Queries' . DIRECTORY_SEPARATOR . 'Public');

            if (!$isSanctioned) {
                $offenders[] = $relative;
            }
        }

        $this->assertEmpty(
            $offenders,
            "withoutGlobalScope() found outside App\\Queries\\Public*: " . implode(', ', $offenders)
        );
    }
}
