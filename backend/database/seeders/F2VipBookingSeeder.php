<?php

namespace Database\Seeders;

use App\Models\Booking;
use App\Models\BookingPricing;
use App\Models\BookingStatusHistory;
use App\Models\Customer;
use App\Models\RentalShop;
use App\Models\Vehicle;
use App\Models\VehicleAvailability;
use App\Services\BookingPricingCalculator;
use App\Support\NumberGenerator;
use Database\Seeders\Concerns\SeedsPasswords;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

/**
 * 100 bookings for the F2-VIP Rental shop's rent vehicles only, spread over
 * past, current and future dates with a realistic mix of statuses. Prices
 * come from BookingPricingCalculator, and confirmed/active/completed
 * bookings block their days in vehicle_availability like the real flow, so
 * no vehicle is double-booked. Bookings go to 15 customers
 * (customer1@f2vip.lk … customer15@f2vip.lk, password "password").
 *
 * Production-safe (no Faker). Skips if the shop already has bookings.
 *
 *   php artisan db:seed --class=F2VipBookingSeeder --force
 */
class F2VipBookingSeeder extends Seeder
{
    use SeedsPasswords;

    private const SHOP_SLUG = 'f2-vip-rental';
    private const COUNT = 100;

    // status => weight
    private const STATUS_WEIGHTS = [
        Booking::STATUS_PENDING => 15,
        Booking::STATUS_CONFIRMED => 20,
        Booking::STATUS_ACTIVE => 10,
        Booking::STATUS_COMPLETED => 30,
        Booking::STATUS_REJECTED => 5,
        Booking::STATUS_EXPIRED => 5,
        Booking::STATUS_CANCELLED_BY_CUSTOMER => 7,
        Booking::STATUS_CANCELLED_BY_OWNER => 4,
        Booking::STATUS_NO_SHOW => 4,
    ];

    // Statuses that hold the vehicle's calendar days.
    private const BLOCKING = [Booking::STATUS_CONFIRMED, Booking::STATUS_ACTIVE, Booking::STATUS_COMPLETED];

    private const CUSTOMER_NAMES = [
        'Mohamed Rizwan', 'Fathima Nusra', 'Ahamed Imran', 'Aysha Rifka', 'Mohamed Fazil',
        'Tharindu Silva', 'Nimali Fernando', 'Kavindu Jayasinghe', 'Sachini Wickramasinghe', 'Isuru Bandara',
        'Suresh Kumar', 'Priya Rajendran', 'Emma Clarke', 'Lukas Weber', 'Yuki Tanaka',
    ];

    private const NOTES = [
        'Please have the car cleaned before pickup.', 'Arriving on a late flight, may be 30 minutes late.',
        'Need a child seat if possible.', 'Will be travelling to Arugam Bay and Ella.',
    ];

    private array $occupied = []; // vehicle_id => [[startDate, endDate], ...]

    public function run(BookingPricingCalculator $calculator): void
    {
        $shop = RentalShop::where('slug', self::SHOP_SLUG)->first();
        if (!$shop) {
            $this->command?->error('F2-VIP Rental shop not found — run F2VipRentalShopSeeder first.');
            return;
        }

        if (Booking::withoutGlobalScopes()->where('shop_id', $shop->id)->exists()) {
            $this->command?->info('F2-VIP Rental already has bookings — skipping.');
            return;
        }

        $vehicles = Vehicle::withoutGlobalScopes()
            ->where('shop_id', $shop->id)
            ->where('listing_type', Vehicle::LISTING_RENT)
            ->whereHas('pricing')
            ->with(['pricing', 'shop.settings'])
            ->get();

        if ($vehicles->isEmpty()) {
            $this->command?->error('F2-VIP Rental has no rent vehicles with pricing.');
            return;
        }

        $customers = $this->customers();
        $created = 0;
        $attempts = 0;

        while ($created < self::COUNT && $attempts < self::COUNT * 50) {
            $attempts++;
            $vehicle = $vehicles->random();
            $status = $this->pickStatus();
            [$pickupAt, $returnAt] = $this->dates($status, $vehicle);

            if (!$this->isFree($vehicle->id, $pickupAt, $returnAt, in_array($status, self::BLOCKING, true))) {
                continue;
            }

            $this->createBooking($calculator, $vehicle, $customers->random(), $status, $pickupAt, $returnAt);
            $created++;
        }

        $this->command?->info("Seeded {$created} bookings for F2-VIP Rental across {$vehicles->count()} vehicles.");
    }

    private function customers(): Collection
    {
        return collect(self::CUSTOMER_NAMES)->map(fn (string $name, int $i) => Customer::firstOrCreate(
            ['email' => 'customer' . ($i + 1) . '@f2vip.lk'],
            [
                'name' => $name,
                // Demo customers: 'password' locally; in production a random, never-shown one (nobody signs in as them).
                'password' => Hash::make($this->seedPassword(null, 'password', 'Demo customer', announce: false)),
                'phone' => '07610000' . str_pad((string) ($i + 1), 2, '0', STR_PAD_LEFT),
                'status' => Customer::STATUS_ACTIVE,
                'registration_source' => 'seeder',
            ]
        ));
    }

    private function pickStatus(): string
    {
        $roll = random_int(1, array_sum(self::STATUS_WEIGHTS));

        foreach (self::STATUS_WEIGHTS as $status => $weight) {
            if (($roll -= $weight) <= 0) {
                return $status;
            }
        }

        return Booking::STATUS_PENDING;
    }

    /** @return array{0: Carbon, 1: Carbon} */
    private function dates(string $status, Vehicle $vehicle): array
    {
        $days = random_int(1, 10);
        $today = now()->startOfDay();

        if ($status === Booking::STATUS_ACTIVE && $days === 1) {
            $days = 2; // so it's still running today
        }

        $offset = match ($status) {
            Booking::STATUS_PENDING, Booking::STATUS_CONFIRMED => random_int(2, 60),
            Booking::STATUS_ACTIVE => -random_int(0, $days - 1),
            Booking::STATUS_CANCELLED_BY_CUSTOMER, Booking::STATUS_CANCELLED_BY_OWNER => random_int(-60, 45),
            default => -random_int($days + 1, 120), // completed, rejected, expired, no_show
        };

        $pickupTime = $vehicle->shop->booking_pickup_time ?? '10:00:00';
        $returnTime = $vehicle->shop->booking_return_time ?? '10:00:00';

        $pickupAt = Carbon::parse($today->copy()->addDays($offset)->toDateString() . ' ' . $pickupTime, config('app.timezone'));
        $returnAt = Carbon::parse($pickupAt->copy()->addDays($days)->toDateString() . ' ' . $returnTime, config('app.timezone'));

        return [$pickupAt, $returnAt];
    }

    private function isFree(int $vehicleId, Carbon $pickupAt, Carbon $returnAt, bool $blocking): bool
    {
        if (!$blocking) {
            return true; // non-blocking statuses never hold the calendar
        }

        $start = $pickupAt->toDateString();
        $end = $returnAt->toDateString();

        foreach ($this->occupied[$vehicleId] ?? [] as [$s, $e]) {
            if ($start <= $e && $end >= $s) {
                return false;
            }
        }

        $taken = VehicleAvailability::where('vehicle_id', $vehicleId)
            ->whereBetween('date', [$start, $end])
            ->whereIn('status', [VehicleAvailability::STATUS_BOOKED, VehicleAvailability::STATUS_BLOCKED, VehicleAvailability::STATUS_MAINTENANCE])
            ->exists();

        if ($taken) {
            return false;
        }

        $this->occupied[$vehicleId][] = [$start, $end];

        return true;
    }

    private function createBooking(BookingPricingCalculator $calculator, Vehicle $vehicle, Customer $customer, string $status, Carbon $pickupAt, Carbon $returnAt): void
    {
        $withDriver = (bool) $vehicle->pricing->driver_rate_per_day && random_int(1, 4) === 1;
        $delivery = (bool) $vehicle->pricing->delivery_available && random_int(1, 4) === 1;
        $quote = $calculator->quote($vehicle, $vehicle->pricing, $pickupAt, $returnAt, $withDriver, $delivery);

        $requestedAt = $pickupAt->copy()->subDays(random_int(1, 14))->setTime(random_int(7, 21), random_int(0, 59));
        if ($requestedAt->isFuture()) {
            $requestedAt = now()->subHours(random_int(1, 20));
        }
        $decidedAt = $requestedAt->copy()->addHours(random_int(1, 12));

        $isPast = $returnAt->isPast();
        $paymentStatus = match (true) {
            $status === Booking::STATUS_COMPLETED => Booking::PAYMENT_PAID,
            $status === Booking::STATUS_ACTIVE => random_int(0, 1) ? Booking::PAYMENT_PAID : Booking::PAYMENT_PARTIALLY_PAID,
            default => Booking::PAYMENT_UNPAID,
        };

        $attrs = [
            'booking_reference' => NumberGenerator::next($vehicle->shop_id, 'booking'),
            'vehicle_id' => $vehicle->id,
            'shop_id' => $vehicle->shop_id,
            'customer_id' => $customer->id,
            'delivery_requested' => $delivery,
            'pickup_at' => $pickupAt,
            'return_at' => $returnAt,
            'rental_days' => $quote['rental_days'],
            'with_driver' => $withDriver,
            'driver_days' => $withDriver ? $quote['rental_days'] : null,
            'status' => $status,
            'payment_status' => $paymentStatus,
            'payment_method' => random_int(0, 2) ? Booking::METHOD_CASH : Booking::METHOD_BANK_TRANSFER,
            'owner_response_deadline_at' => $requestedAt->copy()->addHours($vehicle->shop->settings->owner_response_hours ?? 24),
            'customer_note' => random_int(0, 3) === 0 ? self::NOTES[array_rand(self::NOTES)] : null,
        ];

        $attrs += match ($status) {
            Booking::STATUS_CONFIRMED => ['accepted_at' => $decidedAt, 'confirmed_at' => $decidedAt],
            Booking::STATUS_ACTIVE => ['accepted_at' => $decidedAt, 'confirmed_at' => $decidedAt, 'actual_pickup_at' => $pickupAt],
            Booking::STATUS_COMPLETED => [
                'accepted_at' => $decidedAt, 'confirmed_at' => $decidedAt,
                'actual_pickup_at' => $pickupAt, 'actual_return_at' => $returnAt, 'completed_at' => $returnAt,
                'review_eligible_until' => $returnAt->copy()->addDays(14),
            ],
            Booking::STATUS_REJECTED => ['rejected_at' => $decidedAt, 'rejection_reason' => $this->pick([
                'Vehicle under maintenance for those dates.', 'Not available for the requested period.', 'Minimum rental period not met.',
            ])],
            Booking::STATUS_EXPIRED => ['expired_at' => $attrs['owner_response_deadline_at'], 'expiry_reason' => 'owner_no_response'],
            Booking::STATUS_CANCELLED_BY_CUSTOMER => [
                'cancelled_at' => $decidedAt, 'cancelled_by_type' => 'customer', 'cancelled_by_id' => $customer->id,
                'cancellation_reason' => $this->pick(['Change of travel plans.', 'Found another option.', 'Trip postponed.']),
            ],
            Booking::STATUS_CANCELLED_BY_OWNER => [
                'accepted_at' => $decidedAt, 'confirmed_at' => $decidedAt,
                'cancelled_at' => $decidedAt->copy()->addDay(), 'cancelled_by_type' => 'owner',
                'cancellation_reason' => 'Vehicle unexpectedly unavailable.',
            ],
            Booking::STATUS_NO_SHOW => ['accepted_at' => $decidedAt, 'confirmed_at' => $decidedAt],
            default => [],
        };

        DB::transaction(function () use ($attrs, $quote, $status, $customer, $requestedAt, $decidedAt, $isPast) {
            $booking = new Booking($attrs);
            $booking->created_at = $requestedAt;
            $booking->updated_at = $isPast ? $attrs['return_at'] : $decidedAt->min(now());
            $booking->save();

            BookingPricing::create(array_merge($quote['pricing'], ['booking_id' => $booking->id, 'computed_at' => $requestedAt]));

            $this->history($booking, null, Booking::STATUS_PENDING, 'customer', $customer->id, $requestedAt);
            if ($status !== Booking::STATUS_PENDING) {
                $this->history($booking, Booking::STATUS_PENDING, $status, $status === Booking::STATUS_CANCELLED_BY_CUSTOMER ? 'customer' : 'system', null, $decidedAt);
            }

            if (in_array($status, self::BLOCKING, true)) {
                $rows = [];
                $cursor = $booking->pickup_at->copy()->startOfDay();
                $end = $booking->return_at->copy()->startOfDay();
                while ($cursor->lessThan($end)) {
                    $rows[] = [
                        'vehicle_id' => $booking->vehicle_id, 'date' => $cursor->toDateString(),
                        'status' => VehicleAvailability::STATUS_BOOKED, 'booking_id' => $booking->id,
                        'created_at' => now(), 'updated_at' => now(),
                    ];
                    $cursor->addDay();
                }
                VehicleAvailability::insert($rows);
            }
        });
    }

    private function pick(array $options): string
    {
        return $options[array_rand($options)];
    }

    private function history(Booking $booking, ?string $from, string $to, string $actorType, ?int $actorId, Carbon $at): void
    {
        $row = new BookingStatusHistory([
            'booking_id' => $booking->id, 'field' => 'status', 'from_value' => $from, 'to_value' => $to,
            'actor_type' => $actorType, 'actor_id' => $actorId,
        ]);
        $row->created_at = $at;
        $row->save();
    }
}
