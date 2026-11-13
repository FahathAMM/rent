<?php

namespace Database\Seeders;

use App\Models\Booking;
use App\Models\BookingInspection;
use App\Models\BookingPricing;
use App\Models\BookingStatusHistory;
use App\Models\Customer;
use App\Models\Payment;
use App\Models\RentalShop;
use App\Models\Review;
use App\Models\SecurityDeposit;
use App\Models\SystemAdmin;
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
use Illuminate\Support\Str;
use RuntimeException;

/**
 * 50 bookings for the F2-VIP Rental shop's rent vehicles, spread over past,
 * current and future dates with a fixed mix of statuses. Every booking is
 * written the way the real flow (TransitionBooking, BankTransferService,
 * ReviewService) would have left it:
 *
 *  - prices from BookingPricingCalculator;
 *  - on confirmation: the security deposit row, the booking charge and
 *    deposit statement lines, and the booked days in vehicle_availability
 *    (no vehicle is double-booked);
 *  - bank-transfer bookings: receipts pending, rejected and verified
 *    (advance or full), with payment_status following what was received;
 *  - handover: cash taken at the counter (rental + deposit, or the balance
 *    after a transfer), deposit held, handover inspection;
 *  - return: deposit released (sometimes part kept for damage), return
 *    inspection, and most completed trips reviewed (moderated, some with an
 *    owner reply); vehicle booking_count / rating recomputed;
 *  - cancellations and no-shows reverse the charges on the statement.
 *
 * Each booking is checked against the statement rules (running balance,
 * charges = total payable, payment_status = money received, deposit state,
 * booked days) inside its transaction - a broken one stops the seeder.
 * Bookings go to 15 customers (customer1@f2vip.lk … customer15@f2vip.lk,
 * password "password").
 *
 * Production-safe (no Faker). Skips if the shop already has bookings.
 *
 *   php artisan db:seed --class=F2VipBookingSeeder --force
 */
class F2VipBookingSeeder extends Seeder
{
    use SeedsPasswords;

    private const SHOP_SLUG = 'f2-vip-rental';

    // status => how many (50 in total)
    private const STATUS_COUNTS = [
        Booking::STATUS_PENDING => 6,
        Booking::STATUS_CONFIRMED => 9,
        Booking::STATUS_ACTIVE => 5,
        Booking::STATUS_COMPLETED => 18,
        Booking::STATUS_REJECTED => 2,
        Booking::STATUS_EXPIRED => 2,
        Booking::STATUS_CANCELLED_BY_CUSTOMER => 4,
        Booking::STATUS_CANCELLED_BY_OWNER => 2,
        Booking::STATUS_NO_SHOW => 2,
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

    // rating => [title, comment] options
    private const REVIEWS = [
        5 => [
            ['Excellent service', 'Car was spotless and drove perfectly. Handover took five minutes. Will rent again.'],
            ['Highly recommended', 'Very friendly team, fair price and the vehicle was exactly as shown in the photos.'],
            ['Perfect for our trip', 'Took it to Ella and Nuwara Eliya with no issues at all. Great fuel economy.'],
        ],
        4 => [
            ['Good experience', 'Vehicle was in good condition. Pickup was a little delayed but the staff were helpful.'],
            ['Value for money', 'Clean car, smooth drive. Would have liked a phone holder but otherwise great.'],
        ],
        3 => [
            ['Okay overall', 'The car did the job, but the interior could have been cleaner at pickup.'],
            ['Average', 'Fine for city driving. AC was weak in the afternoons.'],
        ],
    ];

    private const OWNER_REPLIES = [
        'Thank you for choosing F2-VIP Rental — hope to see you again soon!',
        'Thanks for the kind words, it was a pleasure having you.',
        'Thank you for the feedback, we have passed it on to our team.',
    ];

    private const DAMAGE_REASONS = [
        'Scratch on the rear bumper.', 'Cracked side mirror cover.', 'Stain on the rear seat upholstery — cleaning charge.',
    ];

    private array $occupied = []; // vehicle_id => [[startDate, endDate], ...]

    private int $ownerId;
    private ?int $adminId;
    private float $advancePct;

    /** Running statement balance of the booking being written. */
    private float $running = 0.0;
    private Carbon $lastEventAt;
    private int $handoverOdometer = 0;

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

        $this->ownerId = (int) $shop->owner_user_id;
        $this->adminId = SystemAdmin::query()->value('id');
        $this->advancePct = (float) ($shop->advance_percentage ?? 0);

        $customers = $this->customers();
        $statuses = collect(self::STATUS_COUNTS)->flatMap(fn (int $n, string $s) => array_fill(0, $n, $s))->shuffle();
        $created = 0;

        foreach ($statuses as $status) {
            for ($attempt = 0; $attempt < 50; $attempt++) {
                $vehicle = $vehicles->random();
                [$pickupAt, $returnAt] = $this->dates($status, $vehicle);

                if ($this->isFree($vehicle->id, $pickupAt, $returnAt, in_array($status, self::BLOCKING, true))) {
                    $this->createBooking($calculator, $vehicle, $customers->random(), $status, $pickupAt, $returnAt);
                    $created++;
                    break;
                }
            }
        }

        $this->refreshVehicleStats($vehicles);

        $bookingIds = Booking::withoutGlobalScopes()->where('shop_id', $shop->id)->pluck('id');
        $this->command?->info(sprintf(
            'Seeded %d bookings for F2-VIP Rental across %d vehicles: %d statement lines, %d reviews — all passed validation.',
            $created, $vehicles->count(),
            Payment::whereIn('booking_id', $bookingIds)->count(),
            Review::whereIn('booking_id', $bookingIds)->count(),
        ));
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

    /** @return array{0: Carbon, 1: Carbon} */
    private function dates(string $status, Vehicle $vehicle): array
    {
        $days = random_int(1, 10);
        $today = now()->startOfDay();

        if ($status === Booking::STATUS_ACTIVE) {
            $days = max(2, $days); // picked up yesterday or earlier, returning tomorrow or later
        }

        $offset = match ($status) {
            Booking::STATUS_PENDING, Booking::STATUS_CONFIRMED => random_int(2, 60),
            Booking::STATUS_ACTIVE => -random_int(1, $days - 1),
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

        $total = (float) $quote['pricing']['total_payable'];
        $snapshot = $quote['pricing']['pricing_snapshot'];
        $waived = ($snapshot['deposit_method'] ?? null) === 'waived';
        $deposit = $waived ? 0.0 : round((float) ($snapshot['security_deposit'] ?? 0), 2);
        $advance = $this->advance($total);

        $now = now();
        $responseHours = (int) ($vehicle->shop->settings->owner_response_hours ?? 24);

        // Pending requests are recent (still inside the owner's response window); the rest were made days before pickup.
        $requestedAt = $status === Booking::STATUS_PENDING
            ? $now->copy()->subMinutes(random_int(10, max(11, (int) ($responseHours * 60 * 0.8))))
            : $pickupAt->copy()->subDays(random_int(1, 14))->setTime(random_int(7, 21), random_int(0, 59));
        if ($requestedAt->greaterThan($now)) {
            $requestedAt = $now->copy()->subHours(random_int(1, 20));
        }
        $decidedAt = $this->earliest($requestedAt->copy()->addMinutes(random_int(60, 720)), $now, $pickupAt->copy()->subMinutes(30));
        $deadline = $requestedAt->copy()->addHours($responseHours);
        $beforePickup = $this->earliest($now, $pickupAt->copy()->subHour()); // last moment money/cancellations can happen pre-pickup

        $method = random_int(1, 3) === 1 ? Booking::METHOD_BANK_TRANSFER : Booking::METHOD_CASH;

        // Customers can only cancel a confirmed booking while nothing has been paid - and only if it was confirmed in time.
        $cancelFromConfirmed = $status === Booking::STATUS_CANCELLED_BY_CUSTOMER
            && random_int(0, 1) === 1 && $beforePickup->greaterThan($decidedAt->copy()->addHour());
        if ($status === Booking::STATUS_NO_SHOW) {
            $method = Booking::METHOD_CASH;
        }

        // What reached the shop by bank before pickup: none | pending (receipt not yet checked) | advance | full.
        $bank = 'none';
        if ($method === Booking::METHOD_BANK_TRANSFER && $beforePickup->greaterThan($decidedAt->copy()->addHours(2))) {
            $bank = match ($status) {
                Booking::STATUS_CONFIRMED => $this->pick(['none', 'pending', 'advance', 'full']),
                Booking::STATUS_ACTIVE, Booking::STATUS_COMPLETED => $this->pick(['advance', 'full', 'full']),
                Booking::STATUS_CANCELLED_BY_OWNER => $this->pick(['none', 'advance']),
                default => 'none',
            };
            if ($bank === 'advance' && $advance === null) {
                $bank = 'full'; // the shop takes the full amount by transfer
            }
        }

        $paymentStatus = match (true) {
            in_array($status, [Booking::STATUS_ACTIVE, Booking::STATUS_COMPLETED], true) => Booking::PAYMENT_PAID,
            $bank === 'full' => Booking::PAYMENT_PAID,
            $bank === 'advance' => Booking::PAYMENT_PARTIALLY_PAID,
            default => Booking::PAYMENT_UNPAID,
        };

        $confirmed = in_array($status, [
            Booking::STATUS_CONFIRMED, Booking::STATUS_ACTIVE, Booking::STATUS_COMPLETED,
            Booking::STATUS_CANCELLED_BY_OWNER, Booking::STATUS_NO_SHOW,
        ], true) || $cancelFromConfirmed;

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
            'payment_method' => $method,
            'owner_response_deadline_at' => $deadline,
            'customer_note' => random_int(0, 3) === 0 ? self::NOTES[array_rand(self::NOTES)] : null,
        ];

        if ($confirmed) {
            $attrs += ['accepted_at' => $decidedAt, 'confirmed_at' => $decidedAt, 'decided_by' => $this->ownerId];
        }

        DB::transaction(function () use (
            $attrs, $quote, $status, $customer, $requestedAt, $decidedAt, $deadline, $beforePickup,
            $total, $deposit, $waived, $advance, $bank, $confirmed, $cancelFromConfirmed, $pickupAt, $returnAt,
        ) {
            $this->running = 0.0;
            $this->lastEventAt = $requestedAt->copy();

            $booking = new Booking($attrs);
            $booking->created_at = $requestedAt;
            $booking->updated_at = $requestedAt;
            $booking->save();

            BookingPricing::create(array_merge($quote['pricing'], ['booking_id' => $booking->id, 'computed_at' => $requestedAt]));
            $this->history($booking, null, Booking::STATUS_PENDING, 'customer', $customer->id, $requestedAt);

            $securityDeposit = null;
            $paid = 0.0;

            if ($confirmed) {
                $securityDeposit = $this->confirm($booking, $total, $deposit, $waived, $decidedAt);
                $paid = $this->bankTransfers($booking, $bank, $total, $advance, $decidedAt, $beforePickup);
            }

            match ($status) {
                Booking::STATUS_PENDING, Booking::STATUS_CONFIRMED => null,

                Booking::STATUS_REJECTED => $this->reject($booking, $decidedAt),

                Booking::STATUS_EXPIRED => $this->expire($booking, $deadline),

                Booking::STATUS_ACTIVE => $this->handover($booking, $securityDeposit, $total, $deposit, $paid, $pickupAt),

                Booking::STATUS_COMPLETED => $this->complete($booking, $customer, $securityDeposit, $total, $deposit, $paid, $pickupAt, $returnAt),

                Booking::STATUS_CANCELLED_BY_CUSTOMER => $this->cancelByCustomer($booking, $customer, $cancelFromConfirmed, $requestedAt, $decidedAt, $deadline, $beforePickup),

                Booking::STATUS_CANCELLED_BY_OWNER => $this->cancelByOwner($booking, $beforePickup),

                Booking::STATUS_NO_SHOW => $this->noShow($booking, $pickupAt),
            };

            if (in_array($status, self::BLOCKING, true)) {
                $this->writeAvailability($booking);
            }

            Booking::withoutGlobalScopes()->whereKey($booking->id)->update(['updated_at' => $this->lastEventAt]);

            $this->validate($booking->fresh(), $status, $total, $deposit, $paid);
        });
    }

    // ---------------------------------------------------------------- lifecycle steps

    /** pending -> confirmed: the deposit row and the opening statement (rental charge + deposit owed). */
    private function confirm(Booking $booking, float $total, float $deposit, bool $waived, Carbon $at): SecurityDeposit
    {
        $method = $booking->payment_method === Booking::METHOD_CASH ? 'cash_on_pickup' : 'bank_transfer';
        $this->history($booking, Booking::STATUS_PENDING, Booking::STATUS_CONFIRMED, 'staff', $this->ownerId, $at, $method);

        $row = new SecurityDeposit([
            'booking_id' => $booking->id,
            'amount_required' => $deposit,
            'amount_collected' => 0,
            'hold_method' => $waived ? 'waived' : 'cash_on_pickup',
            'status' => SecurityDeposit::STATUS_PENDING,
        ]);
        $row->created_at = $at;
        $row->updated_at = $at;
        $row->save();

        $staff = ['verified_by' => $this->ownerId, 'verified_at' => $at];
        $this->line($booking, Payment::TYPE_BOOKING_CHARGE, $total - $deposit, 0, $at, $staff);
        if ($deposit > 0) {
            $this->line($booking, Payment::TYPE_SECURITY_DEPOSIT, $deposit, 0, $at, $staff);
        }

        return $row;
    }

    /**
     * Bank transfers before pickup. Returns the money the shop verified.
     * Sometimes the first receipt is rejected and the customer uploads again.
     */
    private function bankTransfers(Booking $booking, string $scenario, float $total, ?float $advance, Carbon $from, Carbon $until): float
    {
        if ($scenario === 'none') {
            return 0.0;
        }

        $amount = $scenario === 'full' ? $total : (float) ($advance ?? $total);
        $type = 'rental'; // first money on the booking
        $uploadAt = $this->between($from, $until, 0.1, 0.5);

        if ($scenario === 'pending') {
            $this->line($booking, $type, 0, $amount, $uploadAt, [
                'method' => Payment::METHOD_BANK, 'status' => Payment::STATUS_PENDING,
                'transfer_reference' => $this->transferRef(), 'paid_at' => null,
            ]);

            return 0.0;
        }

        if (random_int(1, 5) === 1) {
            $rejectedAt = $this->between($uploadAt, $until, 0.1, 0.3);
            $this->line($booking, $type, 0, $amount, $uploadAt, [
                'method' => Payment::METHOD_BANK, 'status' => Payment::STATUS_FAILED,
                'transfer_reference' => $this->transferRef(), 'paid_at' => null,
                'verified_by' => $this->ownerId, 'verified_at' => $rejectedAt,
            ], updatedAt: $rejectedAt);
            $uploadAt = $this->between($rejectedAt, $until, 0.1, 0.4);
        }

        $verifiedAt = $this->between($uploadAt, $until, 0.2, 0.6);
        $this->line($booking, $type, 0, $amount, $verifiedAt, [
            'method' => Payment::METHOD_BANK, 'transfer_reference' => $this->transferRef(),
            'verified_by' => $this->ownerId, 'verified_at' => $verifiedAt,
        ], createdAt: $uploadAt);

        $to = $amount >= $total ? Booking::PAYMENT_PAID : Booking::PAYMENT_PARTIALLY_PAID;
        $this->history($booking, Booking::PAYMENT_UNPAID, $to, 'staff', $this->ownerId, $verifiedAt, 'bank_transfer_verified', 'payment_status');

        return $amount;
    }

    private function reject(Booking $booking, Carbon $at): void
    {
        $reason = $this->pick(['Vehicle under maintenance for those dates.', 'Not available for the requested period.', 'Minimum rental period not met.']);
        $booking->update(['rejected_at' => $at, 'rejection_reason' => $reason, 'decided_by' => $this->ownerId]);
        $this->history($booking, Booking::STATUS_PENDING, Booking::STATUS_REJECTED, 'staff', $this->ownerId, $at, $reason);
    }

    private function expire(Booking $booking, Carbon $deadline): void
    {
        $at = $deadline->copy()->addMinutes(random_int(1, 15)); // picked up by the expiry sweep
        $booking->update(['expired_at' => $at, 'expiry_reason' => 'owner_no_response']);
        $this->history($booking, Booking::STATUS_PENDING, Booking::STATUS_EXPIRED, 'system', null, $at, 'owner_no_response');
    }

    /** confirmed -> active: whatever is still due taken in cash, the deposit held, handover inspection. */
    private function handover(Booking $booking, SecurityDeposit $securityDeposit, float $total, float $deposit, float $paid, Carbon $pickupAt): Carbon
    {
        $at = $pickupAt->copy()->addMinutes(random_int(0, 45));
        $cashDue = round($total - $paid, 2);
        $cash = ['method' => Payment::METHOD_CASH];

        if ($paid > 0) {
            if ($cashDue > 0) {
                $this->line($booking, 'balance', 0, $cashDue, $at, $cash);
            }
        } else {
            $rental = max(0, round($cashDue - $deposit, 2));
            if ($rental > 0) {
                $this->line($booking, 'rental', 0, $rental, $at, $cash);
            }
            if ($deposit > 0) {
                $this->line($booking, Payment::TYPE_SECURITY_DEPOSIT, 0, $deposit, $at, $cash);
            }
        }

        if ($deposit > 0) {
            $securityDeposit->forceFill([
                'amount_collected' => $deposit, 'status' => SecurityDeposit::STATUS_HELD,
                'collected_at' => $at, 'updated_at' => $at,
            ])->save();
        }

        $odometer = random_int(15000, 120000);
        $this->inspection($booking, BookingInspection::TYPE_HANDOVER, $odometer, 'full', 'Vehicle handed over in good condition.', $at);

        $booking->update(['actual_pickup_at' => $at]);
        $this->history($booking, Booking::STATUS_CONFIRMED, Booking::STATUS_ACTIVE, 'staff', $this->ownerId, $at);

        $from = match (true) {
            $paid <= 0 => Booking::PAYMENT_UNPAID,
            $paid < $total => Booking::PAYMENT_PARTIALLY_PAID,
            default => null, // already paid in full by transfer
        };
        if ($from !== null) {
            $this->history($booking, $from, Booking::PAYMENT_PAID, 'staff', $this->ownerId, $at, 'cash_received_at_handover', 'payment_status');
        }

        $this->handoverOdometer = $odometer;

        return $at;
    }

    /** active -> completed: the deposit settled on the statement, return inspection, review window opened (and usually used). */
    private function complete(Booking $booking, Customer $customer, SecurityDeposit $securityDeposit, float $total, float $deposit, float $paid, Carbon $pickupAt, Carbon $returnAt): void
    {
        $this->handover($booking, $securityDeposit, $total, $deposit, $paid, $pickupAt);
        $odometer = $this->handoverOdometer + $booking->rental_days * random_int(60, 220);
        $at = $returnAt->copy()->subMinutes(random_int(0, 90));

        $deduction = 0.0;
        $reason = null;
        if ($deposit > 0) {
            if (random_int(1, 5) === 1) {
                $deduction = min($deposit, max(500, round($deposit * random_int(10, 40) / 100 / 500) * 500));
                $reason = $this->pick(self::DAMAGE_REASONS);
            }
            $handedBack = round($deposit - $deduction, 2);
            $staff = ['verified_by' => $this->ownerId, 'verified_at' => $at];

            $this->line($booking, Payment::TYPE_DEPOSIT_RELEASE, 0, $deposit, $at, $staff + ['note' => 'Deposit settled at return']);
            if ($deduction > 0) {
                $this->line($booking, Payment::TYPE_DAMAGE, $deduction, 0, $at, $staff + ['note' => $reason]);
            }
            if ($handedBack > 0) {
                $this->line($booking, Payment::TYPE_SECURITY_DEPOSIT, $handedBack, 0, $at, ['method' => Payment::METHOD_CASH]);
            }

            $securityDeposit->forceFill([
                'deductions_amount' => $deduction,
                'deduction_reason' => $reason,
                'status' => match (true) {
                    $deduction <= 0 => SecurityDeposit::STATUS_RELEASED,
                    $deduction >= $deposit => SecurityDeposit::STATUS_FORFEITED,
                    default => SecurityDeposit::STATUS_PARTIALLY_RELEASED,
                },
                'released_at' => $at,
                'decided_by' => $this->ownerId,
                'updated_at' => $at,
            ])->save();
        }

        $this->inspection($booking, BookingInspection::TYPE_RETURN, $odometer, $this->pick(['full', 'three_quarter', 'half']),
            $reason ? "Returned. {$reason}" : 'Returned on time, no new damage.', $at);

        $booking->update([
            'actual_return_at' => $at,
            'completed_at' => $at,
            'review_eligible_until' => $at->copy()->addDays(14),
        ]);
        $this->history($booking, Booking::STATUS_ACTIVE, Booking::STATUS_COMPLETED, 'staff', $this->ownerId, $at);

        if (random_int(1, 10) <= 8) {
            $this->review($booking, $customer, $at, $deduction > 0);
        }
    }

    private function cancelByCustomer(Booking $booking, Customer $customer, bool $fromConfirmed, Carbon $requestedAt, Carbon $decidedAt, Carbon $deadline, Carbon $beforePickup): void
    {
        $at = $fromConfirmed
            ? $this->between($decidedAt, $beforePickup, 0.2, 0.8)
            : $this->between($requestedAt, $this->earliest($deadline, $beforePickup), 0.1, 0.6);
        $reason = $this->pick(['Change of travel plans.', 'Found another option.', 'Trip postponed.']);

        $booking->update([
            'cancelled_at' => $at, 'cancelled_by_type' => 'customer', 'cancelled_by_id' => $customer->id, 'cancellation_reason' => $reason,
        ]);

        if ($fromConfirmed) {
            $this->reverseCharges($booking, null, $at);
        }
        $this->history($booking, $fromConfirmed ? Booking::STATUS_CONFIRMED : Booking::STATUS_PENDING,
            Booking::STATUS_CANCELLED_BY_CUSTOMER, 'customer', $customer->id, $at, $reason);
    }

    /** Money already transferred stays with the shop (refunded under its own policy) - the balance goes negative. */
    private function cancelByOwner(Booking $booking, Carbon $beforePickup): void
    {
        $at = $this->between($this->lastEventAt, $beforePickup, 0.3, 0.8);
        $reason = $this->pick(['Vehicle unexpectedly unavailable.', 'Vehicle in for unscheduled repairs.']);

        $booking->update([
            'cancelled_at' => $at, 'cancelled_by_type' => 'owner', 'cancelled_by_id' => $this->ownerId, 'cancellation_reason' => $reason,
        ]);
        $this->reverseCharges($booking, $this->ownerId, $at);
        $this->history($booking, Booking::STATUS_CONFIRMED, Booking::STATUS_CANCELLED_BY_OWNER, 'staff', $this->ownerId, $at, $reason);
    }

    private function noShow(Booking $booking, Carbon $pickupAt): void
    {
        $at = $pickupAt->copy()->addHours(random_int(4, 8));
        $this->reverseCharges($booking, null, $at);
        $this->history($booking, Booking::STATUS_CONFIRMED, Booking::STATUS_NO_SHOW, 'system', null, $at);
    }

    /** Credit back the charges still on the statement - money received is untouched. */
    private function reverseCharges(Booking $booking, ?int $actorId, Carbon $at): void
    {
        $charged = (float) Payment::where('booking_id', $booking->id)->whereNull('method')
            ->where('status', Payment::STATUS_SUCCEEDED)->sum(DB::raw('debit - credit'));

        if (round($charged, 2) > 0) {
            $this->line($booking, Payment::TYPE_ADJUSTMENT, 0, $charged, $at, ['verified_by' => $actorId, 'verified_at' => $actorId ? $at : null]);
        }
    }

    private function review(Booking $booking, Customer $customer, Carbon $returnedAt, bool $damaged): void
    {
        $windowEnd = $this->earliest($returnedAt->copy()->addDays(14), now());
        if ($windowEnd->lessThanOrEqualTo($returnedAt->copy()->addHours(2))) {
            return;
        }
        $at = $this->between($returnedAt->copy()->addHours(2), $windowEnd, 0.0, 0.6);

        $rating = $damaged ? random_int(3, 4) : $this->pick([5, 5, 5, 4, 4, 3]);
        [$title, $comment] = $this->pick(self::REVIEWS[$rating]);
        $sub = fn () => max(1, min(5, $rating + $this->pick([0, 0, 0, -1, 1])));

        // Recent reviews may still be waiting for moderation; older ones were published (a few rejected or hidden).
        $roll = random_int(1, 20);
        $status = match (true) {
            $at->diffInDays(now()) < 2 || $this->adminId === null => Review::STATUS_PENDING,
            $roll === 1 => Review::STATUS_REJECTED,
            $roll === 2 => Review::STATUS_HIDDEN,
            default => Review::STATUS_PUBLISHED,
        };
        $moderatedAt = $status === Review::STATUS_PENDING ? null : $this->between($at, now(), 0.05, 0.2);
        $repliedAt = $status === Review::STATUS_PUBLISHED && random_int(0, 1) === 1 ? $this->between($moderatedAt, now(), 0.05, 0.3) : null;

        $review = new Review([
            'booking_id' => $booking->id,
            'vehicle_id' => $booking->vehicle_id,
            'shop_id' => $booking->shop_id,
            'user_id' => $customer->id,
            'rating' => $rating,
            'rating_cleanliness' => $sub(),
            'rating_condition' => $sub(),
            'rating_value' => $sub(),
            'rating_communication' => $sub(),
            'rating_accuracy' => $sub(),
            'title' => $title,
            'comment' => $comment,
            'status' => $status,
            'moderated_by' => $moderatedAt ? $this->adminId : null,
            'moderated_at' => $moderatedAt,
            'moderation_reason' => match ($status) {
                Review::STATUS_REJECTED => 'Contains personal contact details.',
                Review::STATUS_HIDDEN => 'Reported by the shop — under investigation.',
                default => null,
            },
            'owner_reply' => $repliedAt ? $this->pick(self::OWNER_REPLIES) : null,
            'owner_replied_at' => $repliedAt,
            'owner_replied_by' => $repliedAt ? $this->ownerId : null,
            'helpful_count' => $status === Review::STATUS_PUBLISHED ? random_int(0, 12) : 0,
            'is_verified_booking' => true,
        ]);
        $review->created_at = $at;
        $review->updated_at = $repliedAt ?? $moderatedAt ?? $at;
        $review->save();
    }

    private function writeAvailability(Booking $booking): void
    {
        $rows = [];
        $cursor = $booking->pickup_at->copy()->startOfDay();
        $end = $booking->return_at->copy()->startOfDay();
        while ($cursor->lessThan($end)) {
            $rows[] = [
                'vehicle_id' => $booking->vehicle_id, 'date' => $cursor->toDateString(),
                'status' => VehicleAvailability::STATUS_BOOKED, 'booking_id' => $booking->id,
                'created_at' => $booking->confirmed_at ?? now(), 'updated_at' => $booking->confirmed_at ?? now(),
            ];
            $cursor->addDay();
        }
        VehicleAvailability::insert($rows);
    }

    /** booking_count / last_booked_at from completed trips, rating from published reviews - as ReviewService recomputes it. */
    private function refreshVehicleStats(Collection $vehicles): void
    {
        foreach ($vehicles as $vehicle) {
            $completed = Booking::withoutGlobalScopes()->where('vehicle_id', $vehicle->id)->where('status', Booking::STATUS_COMPLETED);
            $ratings = Review::where('vehicle_id', $vehicle->id)->where('status', Review::STATUS_PUBLISHED)
                ->selectRaw('AVG(rating) as avg_rating, COUNT(*) as review_count')->first();

            Vehicle::withoutGlobalScopes()->whereKey($vehicle->id)->update([
                'booking_count' => (clone $completed)->count(),
                'last_booked_at' => (clone $completed)->max('completed_at'),
                'rating_avg' => round((float) $ratings->avg_rating, 2),
                'rating_count' => (int) $ratings->review_count,
            ]);
        }
    }

    // ---------------------------------------------------------------- validation

    /** The statement and booking must agree - any mismatch throws and rolls this booking back. */
    private function validate(Booking $booking, string $status, float $total, float $deposit, float $verifiedByBank): void
    {
        $booking->load(['payments', 'pricing', 'securityDeposit', 'review']);
        $fail = function (string $message) use ($booking, $status) {
            throw new RuntimeException("F2VipBookingSeeder: {$booking->booking_reference} ({$status}) — {$message}");
        };
        $eq = fn (float $a, float $b) => abs($a - $b) < 0.01;

        $lines = Payment::statementOrder($booking->payments);
        $succeeded = $lines->where('status', Payment::STATUS_SUCCEEDED);
        $net = round($succeeded->sum(fn ($p) => (float) $p->debit - (float) $p->credit), 2);
        $paid = $booking->amountPaid();
        $charges = round($succeeded->whereIn('type', [Payment::TYPE_BOOKING_CHARGE])->sum('debit')
            + $succeeded->where('type', Payment::TYPE_SECURITY_DEPOSIT)->whereNull('method')->sum('debit'), 2);
        $availability = VehicleAvailability::where('booking_id', $booking->id)->count();
        $days = (int) $booking->pickup_at->copy()->startOfDay()->diffInDays($booking->return_at->copy()->startOfDay());
        $hasStatement = $booking->confirmed_at !== null;

        // Running balance: each succeeded line carries the balance after it; pending/failed lines carry none.
        $running = 0.0;
        foreach ($booking->payments->sortBy('id') as $line) {
            if ((float) $line->debit > 0 && (float) $line->credit > 0) {
                $fail("line {$line->payment_reference} is both a debit and a credit");
            }
            if ($line->status !== Payment::STATUS_SUCCEEDED) {
                $line->balance === null || $fail("{$line->status} line {$line->payment_reference} has a balance");
                continue;
            }
            $running = round($running + (float) $line->debit - (float) $line->credit, 2);
            $eq((float) $line->balance, $running) || $fail("line {$line->payment_reference} balance {$line->balance} ≠ running {$running}");
        }

        $eq((float) $booking->pricing->total_payable, $total) || $fail('pricing total does not match the quote');
        $eq($paid, $this->moneyReceived($booking)) || $fail('amountPaid() disagrees with the money lines');

        if (!$hasStatement) {
            $lines->isEmpty() || $fail('has statement lines but was never confirmed');
            $booking->securityDeposit === null || $fail('has a security deposit but was never confirmed');
            $booking->payment_status === Booking::PAYMENT_UNPAID || $fail('unconfirmed booking is not unpaid');
        } else {
            $eq($charges, $total) || $fail("opening charges {$charges} ≠ total payable {$total}");
            $eq((float) $booking->securityDeposit?->amount_required, $deposit) || $fail('deposit required does not match the quote');
        }

        $expectedPaymentStatus = match (true) {
            $paid <= 0 => Booking::PAYMENT_UNPAID,
            $paid + 0.01 < $total => Booking::PAYMENT_PARTIALLY_PAID,
            default => Booking::PAYMENT_PAID,
        };

        switch ($status) {
            case Booking::STATUS_CONFIRMED:
                $eq($paid, $verifiedByBank) || $fail('money received ≠ verified transfers');
                $eq($net, $total - $paid) || $fail("statement balance {$net} ≠ total − paid");
                $booking->payment_status === $expectedPaymentStatus || $fail("payment_status {$booking->payment_status} ≠ {$expectedPaymentStatus}");
                $booking->payments->where('status', Payment::STATUS_PENDING)->count() <= 1 || $fail('more than one pending receipt');
                break;

            case Booking::STATUS_ACTIVE:
            case Booking::STATUS_COMPLETED:
                $booking->payment_status === Booking::PAYMENT_PAID || $fail('handed-over booking is not paid');
                $booking->actual_pickup_at !== null || $fail('no actual pickup time');
                $booking->inspections()->where('type', BookingInspection::TYPE_HANDOVER)->exists() || $fail('no handover inspection');
                $booking->payments->where('status', Payment::STATUS_PENDING)->isEmpty() || $fail('pending receipt left after handover');
                $eq($net, 0) || $fail("statement does not settle to zero ({$net})");

                if ($status === Booking::STATUS_ACTIVE) {
                    $eq($paid, $total) || $fail("paid {$paid} ≠ total {$total} at handover");
                    if ($deposit > 0) {
                        $booking->securityDeposit->status === SecurityDeposit::STATUS_HELD || $fail('deposit not held');
                        $eq((float) $booking->securityDeposit->amount_collected, $deposit) || $fail('deposit collected ≠ required');
                    }
                } else {
                    $eq($booking->balanceDue(), 0) || $fail('completed booking still has a balance due');
                    $booking->completed_at !== null && $booking->review_eligible_until !== null || $fail('completion fields missing');
                    $booking->inspections()->where('type', BookingInspection::TYPE_RETURN)->exists() || $fail('no return inspection');
                    if ($deposit > 0) {
                        $sd = $booking->securityDeposit;
                        in_array($sd->status, [SecurityDeposit::STATUS_RELEASED, SecurityDeposit::STATUS_PARTIALLY_RELEASED, SecurityDeposit::STATUS_FORFEITED], true)
                            || $fail("deposit left {$sd->status} after return");
                        (float) $sd->deductions_amount <= (float) $sd->amount_collected || $fail('deposit deduction exceeds what was collected');
                        // Kept by the shop = total payable − deposit handed back.
                        $eq($paid, $total - $deposit + (float) $sd->deductions_amount) || $fail('money kept ≠ rental + deposit deduction');
                    }
                    if ($booking->review) {
                        $r = $booking->review;
                        ($r->rating >= 1 && $r->rating <= 5) || $fail('review rating out of range');
                        $r->user_id === $booking->customer_id || $fail('review not written by the booking customer');
                        $r->created_at->between($booking->completed_at, $booking->review_eligible_until) || $fail('review outside the review window');
                    }
                }
                break;

            case Booking::STATUS_CANCELLED_BY_CUSTOMER:
            case Booking::STATUS_CANCELLED_BY_OWNER:
            case Booking::STATUS_NO_SHOW:
                $booking->review === null || $fail('review on a booking that never completed');
                if ($hasStatement) {
                    $eq($net, -$paid) || $fail("after reversal the balance should be −paid ({$net})");
                    $booking->payments->where('status', Payment::STATUS_PENDING)->isEmpty() || $fail('pending receipt left on a closed booking');
                }
                if ($status === Booking::STATUS_CANCELLED_BY_CUSTOMER) {
                    $paid <= 0 || $fail('customer cancelled a booking that had been paid');
                }
                break;
        }

        if ($status !== Booking::STATUS_COMPLETED && $booking->review !== null) {
            $fail('only completed bookings can have a review');
        }

        $expectedDays = in_array($status, self::BLOCKING, true) ? $days : 0;
        $availability === $expectedDays || $fail("{$availability} booked days ≠ {$expectedDays}");
    }

    private function moneyReceived(Booking $booking): float
    {
        return round($booking->payments->where('status', Payment::STATUS_SUCCEEDED)->whereNotNull('method')
            ->sum(fn ($p) => (float) $p->credit - (float) $p->debit), 2);
    }

    // ---------------------------------------------------------------- helpers

    /** One statement line at a given moment; succeeded lines get the running balance (Payment::settleBalance, timed). */
    private function line(Booking $booking, string $type, float $debit, float $credit, Carbon $at, array $extra = [], ?Carbon $createdAt = null, ?Carbon $updatedAt = null): Payment
    {
        $status = $extra['status'] ?? Payment::STATUS_SUCCEEDED;
        $isMoney = isset($extra['method']);

        if ($status === Payment::STATUS_SUCCEEDED) {
            $this->running = round($this->running + $debit - $credit, 2);
        }

        $payment = new Payment(array_merge([
            'booking_id' => $booking->id,
            'payment_reference' => ($isMoney ? 'PAY-' : match ($type) {
                Payment::TYPE_BOOKING_CHARGE => 'CHG-',
                Payment::TYPE_SECURITY_DEPOSIT => 'DEP-',
                Payment::TYPE_DEPOSIT_RELEASE => 'REL-',
                Payment::TYPE_DAMAGE => 'DMG-',
                default => 'ADJ-',
            }) . Str::upper(Str::random(10)),
            'type' => $type,
            'debit' => round($debit, 2),
            'credit' => round($credit, 2),
            'balance' => $status === Payment::STATUS_SUCCEEDED ? $this->running : null,
            'currency' => $booking->pricing?->currency ?? 'LKR',
            'status' => $status,
            'paid_at' => $at,
            'idempotency_key' => (string) Str::uuid(),
            'initiated_by' => $booking->customer_id,
        ], $extra));
        $payment->created_at = $createdAt ?? $at;
        $payment->updated_at = $updatedAt ?? $at;
        $payment->save();

        $this->touch($updatedAt ?? $at);

        return $payment;
    }

    private function history(Booking $booking, ?string $from, string $to, string $actorType, ?int $actorId, Carbon $at, ?string $reason = null, string $field = 'status'): void
    {
        $row = new BookingStatusHistory([
            'booking_id' => $booking->id, 'field' => $field, 'from_value' => $from, 'to_value' => $to,
            'actor_type' => $actorType, 'actor_id' => $actorId, 'reason' => $reason,
        ]);
        $row->created_at = $at;
        $row->save();

        $this->touch($at);
    }

    private function inspection(Booking $booking, string $type, int $odometer, string $fuel, string $notes, Carbon $at): void
    {
        $ok = fn (array $items) => array_fill_keys($items, 'ok');
        $row = new BookingInspection([
            'booking_id' => $booking->id,
            'type' => $type,
            'odometer_reading' => $odometer,
            'fuel_level' => $fuel,
            'exterior_checklist' => $ok(['body', 'windscreen', 'lights', 'tyres', 'mirrors']),
            'interior_checklist' => $ok(['seats', 'dashboard', 'air_conditioning', 'audio']),
            'accessories_checklist' => $ok(['spare_wheel', 'jack', 'first_aid_kit']),
            'notes' => $notes,
            'customer_present' => true,
            'conducted_by' => $this->ownerId,
            'conducted_at' => $at,
            'terms_accepted_at' => $type === BookingInspection::TYPE_HANDOVER ? $at : null,
        ]);
        $row->created_at = $at;
        $row->updated_at = $at;
        $row->save();
    }

    /** The shop's first-transfer advance (advance_percentage of the total, rounded up), or null when it takes the full amount. */
    private function advance(float $total): ?float
    {
        if ($this->advancePct <= 0) {
            return null;
        }
        $advance = (float) ceil($total * $this->advancePct / 100);

        return $advance < $total ? $advance : null;
    }

    /** A moment between $from and $to, at a random fraction [$min, $max] of the gap. */
    private function between(Carbon $from, Carbon $to, float $min, float $max): Carbon
    {
        $gap = max(0, $to->getTimestamp() - $from->getTimestamp());
        $fraction = $min + (random_int(0, 1000) / 1000) * ($max - $min);

        return $from->copy()->addSeconds((int) ($gap * $fraction));
    }

    private function earliest(Carbon ...$moments): Carbon
    {
        return collect($moments)->sortBy(fn (Carbon $c) => $c->getTimestamp())->first()->copy();
    }

    private function touch(Carbon $at): void
    {
        if ($at->greaterThan($this->lastEventAt)) {
            $this->lastEventAt = $at->copy();
        }
    }

    private function transferRef(): string
    {
        return 'TRX' . random_int(10000000, 99999999);
    }

    private function pick(array $options): mixed
    {
        return $options[array_rand($options)];
    }
}
