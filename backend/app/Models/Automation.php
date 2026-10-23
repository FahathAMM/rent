<?php

namespace App\Models;

use Carbon\Carbon;
use Cron\CronExpression;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Schema;

/**
 * A platform-admin-managed scheduled task — e.g. "Database Backup". This
 * model is the name/cadence/on-off switch an admin edits at
 * /platform/settings; scheduleAll() is what actually turns that into real
 * Laravel schedule entries, called from bootstrap/app.php's withSchedule().
 */
class Automation extends Model
{
    // last_run_at/last_run_status are deliberately excluded — written only by
    // scheduleSelf()'s onSuccess()/onFailure() callbacks via forceFill(), never by the admin API.
    protected $fillable = ['name', 'interval', 'fixed_time', 'is_active'];

    protected $casts = [
        'is_active'    => 'boolean',
        'last_run_at'  => 'datetime',
    ];

    /** Cron equivalents of the named intervals, used only to compute nextRunAt() — scheduleSelf() still calls the named methods directly on the real Schedule. */
    private const INTERVAL_CRON = [
        'everyFiveMinutes'    => '*/5 * * * *',
        'everyTenMinutes'     => '*/10 * * * *',
        'everyFifteenMinutes' => '*/15 * * * *',
        'everyThirtyMinutes'  => '*/30 * * * *',
        'hourly'              => '0 * * * *',
        'everyTwoHours'       => '0 */2 * * *',
        'everyThreeHours'     => '0 */3 * * *',
        'everyFourHours'      => '0 */4 * * *',
        'everySixHours'       => '0 */6 * * *',
    ];

    /**
     * name => artisan command string. A row whose name isn't listed here is
     * saved and shown in the admin UI like any other, but scheduleAll()
     * silently skips it — there's nothing wired up yet for it to run.
     */
    private const COMMANDS = [
        'Database Backup' => 'backup:run --only-db',
    ];

    /**
     * Laravel's own Schedule method names, from 5 minutes up to every six
     * hours — stored verbatim (not a separate slug) so a value here can be
     * called directly as $schedule->command(...)->{$interval}() once this
     * table drives the scheduler, with no translation table in between.
     */
    public const INTERVALS = [
        'everyFiveMinutes',
        'everyTenMinutes',
        'everyFifteenMinutes',
        'everyThirtyMinutes',
        'hourly',
        'everyTwoHours',
        'everyThreeHours',
        'everyFourHours',
        'everySixHours',
    ];

    /** Selecting this (alongside or instead of a recurring interval) also runs the task once a day at `fixed_time`. */
    public const FIXED_TIME = 'fixed_time';

    /** `interval` is a comma-separated list — a task can run on more than one cadence, e.g. "everyTenMinutes,hourly". */
    public function intervals(): array
    {
        return array_values(array_filter(array_map('trim', explode(',', (string) $this->interval))));
    }

    public function isFixedTime(): bool
    {
        return in_array(self::FIXED_TIME, $this->intervals(), true);
    }

    /**
     * Validates a raw comma-separated interval string (as submitted by the
     * request, before it's saved) — every piece must be one of INTERVALS or
     * FIXED_TIME, non-empty, and not repeated. Returns an error message, or
     * null when the value is valid.
     */
    public static function validateIntervalList(string $value): ?string
    {
        $allowed = [...self::INTERVALS, self::FIXED_TIME];
        $values = array_filter(array_map('trim', explode(',', $value)));

        if (empty($values)) {
            return 'Select at least one interval.';
        }

        foreach ($values as $v) {
            if (!in_array($v, $allowed, true)) {
                return "\"{$v}\" is not a valid interval.";
            }
        }

        if (count($values) !== count(array_unique($values))) {
            return 'The interval list contains duplicate values.';
        }

        return null;
    }

    /**
     * Called from bootstrap/app.php's withSchedule() — reads every active
     * row fresh each time this runs (only on a schedule:* command, which
     * re-boots the app), so a change saved at /platform/settings takes
     * effect on the very next tick, no deploy/restart needed.
     *
     * Falls back to the original hardcoded schedule if the table isn't
     * there yet (fresh install before migrations run), has no active rows,
     * or the query fails for any reason — the schedule existing at all
     * matters more than honoring the admin-configured cadence.
     */
    public static function scheduleAll(Schedule $schedule): void
    {
        try {
            if (!Schema::hasTable('automations')) {
                self::scheduleFallback($schedule);
                return;
            }

            $automations = static::where('is_active', true)->get();

            if ($automations->isEmpty()) {
                self::scheduleFallback($schedule);
                return;
            }

            foreach ($automations as $automation) {
                $automation->scheduleSelf($schedule);
            }
        } catch (\Throwable) {
            self::scheduleFallback($schedule);
        }
    }

    private function scheduleSelf(Schedule $schedule): void
    {
        $command = self::COMMANDS[$this->name] ?? null;
        if (!$command) {
            return; // no artisan command wired up for this row's name — nothing to run
        }

        foreach ($this->intervals() as $interval) {
            if ($interval === self::FIXED_TIME) {
                if (!$this->fixed_time) {
                    continue;
                }
                $event = $schedule->command($command)->dailyAt(substr($this->fixed_time, 0, 5))->withoutOverlapping();
            } elseif (in_array($interval, self::INTERVALS, true)) {
                $event = $schedule->command($command)->{$interval}()->withoutOverlapping();
            } else {
                continue;
            }

            // Fires inside the scheduler's own process after the command's child
            // process exits — $this is still the same Automation instance, so this
            // just records "did this row's task run, and how did it go" regardless
            // of which interval (if this row has more than one) triggered it.
            $event->onSuccess(fn() => $this->recordRun('success'))->onFailure(fn() => $this->recordRun('failed'));
        }
    }

    private function recordRun(string $status): void
    {
        $this->forceFill(['last_run_at' => now(), 'last_run_status' => $status])->save();
    }

    /** Soonest upcoming run across every interval on this row — null if inactive or unschedulable (e.g. fixed_time not set). */
    public function nextRunAt(): ?Carbon
    {
        if (!$this->is_active) {
            return null;
        }

        $next = null;

        foreach ($this->intervals() as $interval) {
            $cron = $this->cronFor($interval);
            if (!$cron) {
                continue;
            }

            try {
                $date = Carbon::instance((new CronExpression($cron))->getNextRunDate());
            } catch (\Throwable) {
                continue;
            }

            if ($next === null || $date->lt($next)) {
                $next = $date;
            }
        }

        return $next;
    }

    private function cronFor(string $interval): ?string
    {
        if ($interval === self::FIXED_TIME) {
            if (!$this->fixed_time) {
                return null;
            }
            [$hour, $minute] = explode(':', substr($this->fixed_time, 0, 5));

            return sprintf('%d %d * * *', (int) $minute, (int) $hour);
        }

        return self::INTERVAL_CRON[$interval] ?? null;
    }

    /** Safety net used when the automations table isn't there yet / has no active rows / errors out. */
    private static function scheduleFallback(Schedule $schedule): void
    {
        $schedule->command('backup:run --only-db')->dailyAt('01:00')->withoutOverlapping();
    }
}
