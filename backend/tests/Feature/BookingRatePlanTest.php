<?php

namespace Tests\Feature;

use App\Models\Vehicle;
use App\Models\VehiclePricing;
use App\Services\BookingPricingCalculator;
use Carbon\Carbon;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * 30-day months at the monthly rate, then 7-day weeks at the weekly rate,
 * then leftover days at the daily rate.
 */
class BookingRatePlanTest extends TestCase
{
    public static function cases(): array
    {
        // days, weekly, monthly, expected base, expected plan
        return [
            'under a week' => [5, 40000, 150000, 5 * 7000, 'daily'],
            'exactly a week' => [7, 40000, 150000, 40000, 'weekly'],
            'week plus days' => [10, 40000, 150000, 40000 + 3 * 7000, 'mixed'],
            'two weeks' => [14, 40000, 150000, 80000, 'weekly'],
            'exactly a month' => [30, 40000, 150000, 150000, 'monthly'],
            'month week days' => [40, 40000, 150000, 150000 + 40000 + 3 * 7000, 'mixed'],
            'no weekly rate' => [10, null, null, 10 * 7000, 'daily'],
            'no monthly rate' => [30, 40000, null, 4 * 40000 + 2 * 7000, 'mixed'],
        ];
    }

    #[DataProvider('cases')]
    public function test_rate_plan(int $days, ?int $weekly, ?int $monthly, float $expectedBase, string $expectedPlan): void
    {
        $pricing = new VehiclePricing(['daily_rate' => 7000, 'weekly_rate' => $weekly, 'monthly_rate' => $monthly, 'tax_rate' => 0, 'security_deposit' => 0]);
        $pickup = Carbon::parse('2026-12-01 10:00');

        $quote = (new BookingPricingCalculator)->quote(new Vehicle, $pricing, $pickup, $pickup->copy()->addDays($days), false, false);

        $this->assertSame($days, $quote['rental_days']);
        $this->assertEquals($expectedBase, $quote['pricing']['base_amount']);
        $this->assertSame($expectedPlan, $quote['pricing']['rate_plan']);
    }
}
