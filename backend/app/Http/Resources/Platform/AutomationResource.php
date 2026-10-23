<?php

namespace App\Http\Resources\Platform;

use Illuminate\Http\Resources\Json\JsonResource;

class AutomationResource extends JsonResource
{
    private const INTERVAL_LABELS = [
        'everyFiveMinutes'    => 'Every 5 minutes',
        'everyTenMinutes'     => 'Every 10 minutes',
        'everyFifteenMinutes' => 'Every 15 minutes',
        'everyThirtyMinutes'  => 'Every 30 minutes',
        'hourly'              => 'Every hour',
        'everyTwoHours'       => 'Every 2 hours',
        'everyThreeHours'     => 'Every 3 hours',
        'everyFourHours'      => 'Every 4 hours',
        'everySixHours'       => 'Every 6 hours',
        'fixed_time'          => 'Fixed time',
    ];

    public function toArray($request): array
    {
        // interval is comma-separated — a task can run on more than one
        // cadence (e.g. "everyTenMinutes,hourly") — so the label joins each
        // piece's human-readable name rather than looking up the raw string whole.
        $intervals = $this->intervals();
        $intervalLabel = implode(', ', array_map(
            fn ($value) => self::INTERVAL_LABELS[$value] ?? $value,
            $intervals
        ));

        return [
            'id'             => $this->id,
            'name'           => $this->name,
            'interval'       => $this->interval,
            'intervals'      => $intervals,
            'interval_label' => $intervalLabel,
            // MySQL TIME columns come back as "HH:MM:SS" — trim to "HH:MM" to match the H:i the request validates against.
            'fixed_time'     => $this->fixed_time ? substr($this->fixed_time, 0, 5) : null,
            'is_active'      => $this->is_active,
            'last_run_at'    => $this->last_run_at?->toISOString(),
            'last_run_status' => $this->last_run_status,
            'next_run_at'    => $this->nextRunAt()?->toISOString(),
            'created_at'     => $this->created_at?->toISOString(),
        ];
    }
}
