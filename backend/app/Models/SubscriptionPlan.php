<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** A shop plan (Basic / Pro / Business) — price per period, limits (null = unlimited) and feature switches. */
class SubscriptionPlan extends Model
{
    /** Code of the stand-in plan an unpaid shop gets (never stored). */
    public const NONE = 'none';

    /** Feature switches a plan can turn on, with their labels. */
    public const FEATURES = [
        'calendar' => 'Availability calendar',
        'expenses' => 'Expenses',
        'staff' => 'Staff & roles',
    ];

    /** Limit name => column. */
    public const LIMITS = [
        'vehicles' => 'max_vehicles',
        'staff' => 'max_staff',
        'locations' => 'max_locations',
    ];

    protected $fillable = [
        'code', 'name', 'description', 'price', 'period_days',
        'max_vehicles', 'max_staff', 'max_locations', 'features', 'is_active', 'sort_order',
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'period_days' => 'integer',
        'max_vehicles' => 'integer',
        'max_staff' => 'integer',
        'max_locations' => 'integer',
        'features' => 'array',
        'is_active' => 'boolean',
        'sort_order' => 'integer',
    ];

    public function hasFeature(string $feature): bool
    {
        return in_array($feature, $this->features ?? [], true);
    }

    /** null = unlimited. */
    public function limit(string $name): ?int
    {
        return $this->{self::LIMITS[$name]};
    }

    /** What an unpaid shop has: nothing — its vendor workspace is locked until it pays (EnsureSubscriptionActive). */
    public static function none(): self
    {
        return new static(['code' => self::NONE, 'name' => 'No plan', 'price' => 0, 'period_days' => 30, 'max_vehicles' => 0, 'max_staff' => 0, 'max_locations' => 0, 'features' => []]);
    }
}
