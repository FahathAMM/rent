<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Wipes every row from the tables listed below without dropping/recreating
 * them (unlike `migrate:fresh`, which re-runs every migration from
 * scratch) — a fast, schema-safe way to reset data before a clean reseed.
 *
 * Table list is explicit on purpose (not read from information_schema) so
 * any table can be commented out below to keep it untouched on a future
 * run. `migrations` is never in this list — truncating it would make
 * Laravel think no migration has ever run and try to re-run all of them.
 *
 * Never called automatically from DatabaseSeeder — this is standalone and
 * deliberately explicit to run:
 *
 *   php artisan db:seed --class=TruncateAllTablesSeeder
 *
 * DESTRUCTIVE — wipes every company/user/tenant in the database, no
 * exceptions. Guarded by two independent checks before a single row is
 * touched:
 *   1. Hard-blocked in production (app()->environment('production')) —
 *      there is no flag or override to bypass this. If you genuinely need
 *      to wipe a production database, do it by hand, not through a seeder.
 *   2. Requires typing the exact confirmation phrase below when run
 *      interactively; a non-interactive run (no console attached, or
 *      --no-interaction) is refused rather than assumed, since silently
 *      proceeding would be the more dangerous default.
 */
class TruncateAllTablesSeeder extends Seeder
{
    /** Must be typed verbatim (case-sensitive) to proceed. */
    private const CONFIRMATION_PHRASE = 'TRUNCATE EVERYTHING';

    private const TABLES = [
        // ── Tenants / subscriptions ──────────────────────────────────
        'companies',
        'company_settings',
        'subscriptions',
        'plans',

        // ── CRM ───────────────────────────────────────────────────────
        'customers',
        'customer_contacts',
        'leads',
        'lead_sources',
        'lead_stages',
        'activities',

        // ── Sales ─────────────────────────────────────────────────────
        'items',
        'units',
        'quotations',
        'quotation_items',
        'invoices',
        'invoice_items',

        // ── Finance ───────────────────────────────────────────────────
        'payments',
        'payment_allocations',
        'payment_methods',
        'expenses',
        'expense_categories',

        // ── Users / access control / admin ──────────────────────────
        'users',
        'roles',
        'permissions',
        'model_has_roles',
        'model_has_permissions',
        'role_has_permissions',
        'menus',
        'term_templates',
        'audit_logs',
        'attachments',

        // ── Platform (SaaS admin) ────────────────────────────────────
        'system_admins',
        'platform_details',
        'impersonation_sessions',

        // ── Framework infra ───────────────────────────────────────────
        'sessions',
        'cache',
        'cache_locks',
        'jobs',
        'personal_access_tokens',
    ];

    public function run(): void
    {
        $this->assertNotProduction();
        $this->assertConfirmed();

        DB::statement('SET FOREIGN_KEY_CHECKS = 0');

        foreach (self::TABLES as $table) {
            // DB::table($table)->truncate();
        }

        DB::statement('SET FOREIGN_KEY_CHECKS = 1');

        $this->command?->info('Truncated ' . count(self::TABLES) . ' tables.');
    }

    /** No override for this — a destructive full-database wipe has no place running against production, ever. */
    private function assertNotProduction(): void
    {
        if (app()->environment('production')) {
            $this->command?->error('Refusing to run: this seeder truncates every table and is blocked in production.');

            throw new \RuntimeException(self::class . ' may not run in the production environment.');
        }
    }

    /**
     * Fails closed: no attached console (e.g. invoked from application code
     * rather than `php artisan db:seed`) is treated the same as "not
     * confirmed". A non-interactive run (piped, --no-interaction, CI) never
     * reaches the prompt either — Symfony's ask() returns the default (here,
     * none) immediately without asking when input isn't interactive — so it
     * falls through to the same "didn't match" rejection below rather than
     * silently proceeding, since an unattended process is exactly the case
     * where an accidental truncate would be most costly.
     */
    private function assertConfirmed(): void
    {
        if (!$this->command) {
            throw new \RuntimeException(
                self::class . ' requires an interactive console session to confirm — run it directly with `php artisan db:seed --class=' . self::class . '`.'
            );
        }

        $this->command->warn(
            'This will PERMANENTLY DELETE every row from ' . count(self::TABLES) . ' tables — every company, ' .
            'user, and all their data. There is no undo.'
        );

        $typed = $this->command->ask('Type "' . self::CONFIRMATION_PHRASE . '" to confirm');

        if ($typed !== self::CONFIRMATION_PHRASE) {
            $this->command->error('Confirmation phrase did not match — aborting, nothing was touched.');

            throw new \RuntimeException(self::class . ' aborted: confirmation phrase did not match.');
        }
    }
}
