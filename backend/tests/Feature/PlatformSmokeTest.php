<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Customer;
use App\Models\Dispute;
use App\Models\Payment;
use App\Models\Promotion;
use App\Models\RentalShop;
use App\Models\ShopVerification;
use App\Models\SubscriptionPayment;
use App\Models\SystemAdmin;
use App\Models\Vehicle;
use App\Models\VehicleBrand;
use App\Models\VehicleCategory;
use App\Models\VehicleModel;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

/**
 * Deep smoke test of the whole platform console: on the full demo data
 * (DatabaseSeeder — shop, vehicles, customers, 50 bookings), every platform
 * GET endpoint is called with real ids, as every admin role, plain and with
 * the usual table filters. Nothing may crash (5xx); every page the owner
 * opens must load (200). Routes are read from the router, so new platform
 * pages are covered automatically.
 */
class PlatformSmokeTest extends TestCase
{
    use RefreshDatabase;

    /** Endpoints that stream a file which may not exist in a test run: must not crash, but 404 is fine. */
    private const FILE_ROUTES = ['download', 'proof'];

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(DatabaseSeeder::class);
    }

    /** uri => concrete url, or null when there is no row to point it at. */
    private function urls(): array
    {
        $params = [
            '{reference}' => fn (string $uri) => str_contains($uri, 'disputes')
                ? Dispute::value('dispute_reference')
                : Booking::value('booking_reference'),
            '{customer}' => fn () => Customer::value('id'),
            '{rentalShop}' => fn () => RentalShop::value('id'),
            '{vehicle}' => fn () => Vehicle::value('id'),
            '{brand}' => fn () => VehicleBrand::value('id'),
            '{category}' => fn () => VehicleCategory::value('id'),
            '{payment}' => fn (string $uri) => str_contains($uri, 'subscription')
                ? SubscriptionPayment::value('id')
                : Payment::value('id'),
            '{promotion}' => fn () => Promotion::value('id'),
            '{report}' => fn () => 'income-statement',
            '{verification}' => fn () => ShopVerification::value('id'),
        ];

        $urls = [];
        foreach (Route::getRoutes() as $route) {
            $uri = $route->uri();
            if (! str_starts_with($uri, 'api/platform/') || ! in_array('GET', $route->methods(), true)) {
                continue;
            }

            $url = '/' . $uri;
            foreach ($params as $placeholder => $resolve) {
                if (str_contains($url, $placeholder)) {
                    $value = $resolve($uri);
                    $url = $value === null ? null : str_replace($placeholder, (string) $value, $url);
                }
                if ($url === null) {
                    break;
                }
            }
            if ($url !== null && preg_match('/\{[^}]+\}/', $url)) {
                $this->fail("PlatformSmokeTest has no id for {$uri} — add its placeholder to urls().");
            }
            $urls[$uri] = $url === null ? null : $url . ($this->requiredQuery()[$uri] ?? '');
        }

        return $urls;
    }

    /** Endpoints that need a query param to know what to return — the same one their page always sends. */
    private function requiredQuery(): array
    {
        $logFile = 'laravel.log';
        File::ensureDirectoryExists(storage_path('logs'));
        if (! File::exists(storage_path("logs/{$logFile}"))) {
            File::put(storage_path("logs/{$logFile}"), '');
        }

        return [
            'api/platform/help-items' => '?type=faq',
            'api/platform/vehicle-variants' => '?model_id=' . (VehicleModel::value('id') ?? 0),
            'api/platform/logs/entries' => '?file=' . $logFile,
        ];
    }

    private function as(SystemAdmin $admin)
    {
        $token = $admin->createToken('smoke')->plainTextToken;

        return $this->withHeader('Authorization', "Bearer {$token}")->withHeader('Accept', 'application/json');
    }

    private function isFileRoute(string $uri): bool
    {
        return collect(self::FILE_ROUTES)->contains(fn ($f) => str_contains($uri, $f));
    }

    public function test_every_platform_page_loads_for_the_owner_on_demo_data(): void
    {
        $owner = SystemAdmin::factory()->owner()->create();
        $failures = [];
        $skipped = [];

        foreach ($this->urls() as $uri => $url) {
            if ($url === null) {
                $skipped[] = $uri;
                continue;
            }
            $status = $this->as($owner)->getJson($url)->status();
            $ok = $this->isFileRoute($uri) ? $status < 500 : $status === 200;
            if (! $ok) {
                $failures[] = "{$status} GET {$url}";
            }
        }

        $this->assertSame([], $failures, "Platform endpoints failing:\n" . implode("\n", $failures));
        // Demo data must be rich enough to reach the detail pages that matter.
        foreach (['api/platform/bookings/{reference}', 'api/platform/customers/{customer}', 'api/platform/shops/{rentalShop}', 'api/platform/listings/{vehicle}'] as $must) {
            $this->assertNotContains($must, $skipped, "{$must} had no demo row to test against");
        }
    }

    public function test_table_filters_and_paging_never_crash(): void
    {
        $owner = SystemAdmin::factory()->owner()->create();
        $queries = [
            '?page=1&perPage=10',
            '?page=2&perPage=5',
            '?search=a',
            '?search=%25%27%22', // % ' " — must be escaped, not break the SQL
            '?status=pending',
            '?status=active',
            '?sortBy=created_at&sortOrder=asc',
            '?from=2026-01-01&to=2026-12-31',
        ];
        $failures = [];

        foreach ($this->urls() as $uri => $url) {
            if ($url === null || $this->isFileRoute($uri) || preg_match('/\/\d+$|\/[A-Z]{2,}-/', $url)) {
                continue; // filters only apply to list endpoints
            }
            foreach ($queries as $q) {
                $full = str_contains($url, '?') ? $url . '&' . ltrim($q, '?') : $url . $q;
                $status = $this->as($owner)->getJson($full)->status();
                if ($status >= 500) {
                    $failures[] = "{$status} GET {$full}";
                }
            }
        }

        $this->assertSame([], $failures, "Platform list filters crashing:\n" . implode("\n", $failures));
    }

    public function test_every_admin_role_gets_an_answer_never_a_crash(): void
    {
        $admins = [
            'admin' => SystemAdmin::factory()->create(),
            'finance' => SystemAdmin::factory()->finance()->create(),
            'moderator' => SystemAdmin::factory()->moderator()->create(),
        ];
        $failures = [];

        foreach ($admins as $role => $admin) {
            foreach ($this->urls() as $uri => $url) {
                if ($url === null) {
                    continue;
                }
                $status = $this->as($admin)->getJson($url)->status();
                if ($status >= 500) {
                    $failures[] = "{$role}: {$status} GET {$url}";
                }
            }
        }

        $this->assertSame([], $failures, "Platform endpoints crashing for some roles:\n" . implode("\n", $failures));
    }

    public function test_the_platform_is_closed_to_guests_customers_and_vendors(): void
    {
        $customerToken = Customer::first()->createToken('c')->plainTextToken;
        $vendorToken = RentalShop::first()->owner->createToken('v')->plainTextToken;
        $leaks = [];

        foreach ($this->urls() as $uri => $url) {
            if ($url === null) {
                continue;
            }
            foreach (['guest' => null, 'customer' => $customerToken, 'vendor' => $vendorToken] as $who => $token) {
                $this->app['auth']->forgetGuards();
                $request = $this->withHeaders(['Accept' => 'application/json', 'Authorization' => $token ? "Bearer {$token}" : '']);
                $status = $request->getJson($url)->status();
                if (! in_array($status, [401, 403], true)) {
                    $leaks[] = "{$who}: {$status} GET {$url}";
                }
            }
        }

        $this->assertSame([], $leaks, "Platform endpoints open to non-admins:\n" . implode("\n", $leaks));
    }
}
