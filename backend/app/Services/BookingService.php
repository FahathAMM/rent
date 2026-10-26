<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\BookingPricing;
use App\Models\BookingStatusHistory;
use App\Models\Customer;
use App\Models\ReservationHold;
use App\Models\Vehicle;
use App\Models\VehicleAvailability;
use App\Models\VehiclePricing;
use App\Support\NumberGenerator;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Booking request creation - see app-doc/marketplace/04-lifecycles.md
 * "— -> pending" transition rule. Deliberately does NOT lock the
 * vehicle or write a reservation_hold: a mere request never blocks the
 * calendar (several customers may request the same dates), only
 * TransitionBooking::accept() does. This only screens out obviously
 * impossible requests for UX; accept-time revalidation is the real
 * authority.
 */
class BookingService
{
    public function __construct(private BookingPricingCalculator $calculator) {}

    public function create(Customer $customer, Vehicle $vehicle, array $data): Booking
    {
        $pricing = $vehicle->pricing;
        abort_if(!$pricing, 422, 'This vehicle has no pricing configured yet.');

        $pickupAt = Carbon::parse($data['pickup_at']);
        $returnAt = Carbon::parse($data['return_at']);

        $this->assertRequestIsValid($vehicle, $pricing, $pickupAt, $returnAt);

        $withDriver = (bool) ($data['with_driver'] ?? false);
        $deliveryRequested = (bool) ($data['delivery_requested'] ?? false);

        $quote = $this->calculator->quote($vehicle, $pricing, $pickupAt, $returnAt, $withDriver, $deliveryRequested);

        $shopSettings = $vehicle->shop->settings;
        $responseHours = $shopSettings->owner_response_hours ?? 24;

        return DB::transaction(function () use ($customer, $vehicle, $pickupAt, $returnAt, $quote, $withDriver, $deliveryRequested, $responseHours, $data) {
            $booking = Booking::create([
                'booking_reference' => NumberGenerator::next($vehicle->shop_id, 'booking'),
                'vehicle_id' => $vehicle->id,
                'shop_id' => $vehicle->shop_id,
                'customer_id' => $customer->id,
                'pickup_location_id' => $data['pickup_location_id'] ?? null,
                'pickup_address' => $data['pickup_address'] ?? null,
                'return_location_id' => $data['return_location_id'] ?? null,
                'return_address' => $data['return_address'] ?? null,
                'delivery_requested' => $deliveryRequested,
                'pickup_at' => $pickupAt,
                'return_at' => $returnAt,
                'rental_days' => $quote['rental_days'],
                'with_driver' => $withDriver,
                'driver_days' => $withDriver ? $quote['rental_days'] : null,
                'status' => Booking::STATUS_PENDING,
                'payment_status' => Booking::PAYMENT_UNPAID,
                'owner_response_deadline_at' => now()->addHours($responseHours),
                'customer_note' => $data['customer_note'] ?? null,
            ]);

            BookingPricing::create($quote['pricing'] + ['booking_id' => $booking->id]);

            BookingStatusHistory::create([
                'booking_id' => $booking->id,
                'field' => 'status',
                'from_value' => null,
                'to_value' => Booking::STATUS_PENDING,
                'actor_type' => 'customer',
                'actor_id' => $customer->id,
            ]);

            return $booking->fresh(['pricing']);
        });
    }

    private function assertRequestIsValid(Vehicle $vehicle, VehiclePricing $pricing, Carbon $pickupAt, Carbon $returnAt): void
    {
        abort_unless($vehicle->isPubliclyVisible(), 422, 'This vehicle is not currently available for booking.');
        abort_unless($vehicle->shop->status === 'active' && $vehicle->shop->is_published, 422, 'This shop is not currently accepting bookings.');

        if ($returnAt->lessThanOrEqualTo($pickupAt)) {
            throw ValidationException::withMessages(['return_at' => ['Return date must be after pickup date.']]);
        }

        if ($pickupAt->lessThan(now()->addHours($pricing->advance_notice_hours))) {
            throw ValidationException::withMessages(['pickup_at' => ["Pickup must be at least {$pricing->advance_notice_hours} hours from now."]]);
        }

        $days = max(1, (int) ceil($pickupAt->diffInHours($returnAt) / 24));
        if ($days < $pricing->min_rental_days) {
            throw ValidationException::withMessages(['return_at' => ["Minimum rental is {$pricing->min_rental_days} day(s)."]]);
        }
        if ($pricing->max_rental_days && $days > $pricing->max_rental_days) {
            throw ValidationException::withMessages(['return_at' => ["Maximum rental is {$pricing->max_rental_days} day(s)."]]);
        }

        $overlap = Booking::where('vehicle_id', $vehicle->id)
            ->whereIn('status', [Booking::STATUS_CONFIRMED, Booking::STATUS_ACTIVE])
            ->where('pickup_at', '<', $returnAt)
            ->where('return_at', '>', $pickupAt)
            ->exists();
        if ($overlap) {
            throw ValidationException::withMessages(['pickup_at' => ['Vehicle is already booked for part of those dates.']]);
        }

        $blocked = VehicleAvailability::where('vehicle_id', $vehicle->id)
            ->whereIn('status', [VehicleAvailability::STATUS_BLOCKED, VehicleAvailability::STATUS_MAINTENANCE])
            ->whereBetween('date', [$pickupAt->toDateString(), $returnAt->copy()->subDay()->toDateString()])
            ->exists();
        if ($blocked) {
            throw ValidationException::withMessages(['pickup_at' => ['Some of those dates are unavailable.']]);
        }

        $heldElsewhere = ReservationHold::where('vehicle_id', $vehicle->id)
            ->where('status', ReservationHold::STATUS_ACTIVE)
            ->where('expires_at', '>', now())
            ->where('start_date', '<', $returnAt)
            ->where('end_date', '>', $pickupAt)
            ->exists();
        if ($heldElsewhere) {
            throw ValidationException::withMessages(['pickup_at' => ['Vehicle is on hold for another request over those dates.']]);
        }
    }
}
