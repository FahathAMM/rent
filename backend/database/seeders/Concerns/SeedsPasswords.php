<?php

namespace Database\Seeders\Concerns;

use Illuminate\Support\Str;

/**
 * Passwords for seeded accounts. Never a fixed, committed password in
 * production: the env value when one is set, otherwise a random one
 * (printed once so the operator can sign in and change it). Outside
 * production the easy dev default still applies, so local logins work.
 */
trait SeedsPasswords
{
    protected function seedPassword(?string $envKey, string $devDefault, string $who, bool $announce = true): string
    {
        $fromEnv = $envKey ? (env($envKey) ?: null) : null;
        if ($fromEnv) {
            return $fromEnv;
        }

        if (!app()->isProduction()) {
            return $devDefault;
        }

        $password = Str::password(20);
        if ($announce) {
            $this->command?->warn("{$who}: no {$envKey} set — generated password (shown once, change it after signing in): {$password}");
        }

        return $password;
    }
}
