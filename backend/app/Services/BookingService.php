<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\BookingPricing;
use App\Models\BookingStatusHistory;
use App\Models\Customer;
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
 * vehicle: a mere request never blocks the
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

        $pickupAt = Carbon::parse($data['pickup_at'], config('app.timezone'));
        $returnAt = Carbon::parse($data['return_at'], config('app.timezone'));

        $this->assertRequestIsValid($vehicle, $pricing, $pickupAt, $returnAt);

        $withDriver = (bool) ($data['with_driver'] ?? false);
        $deliveryRequested = (bool) ($data['delivery_requested'] ?? false);

        $quote = $this->calculator->quote($vehicle, $pricing, $pickupAt, $returnAt, $withDriver, $deliveryRequested);

        $shopSettings = $vehicle->shop->settings;
        $responseHours = $shopSettings->owner_response_hours ?? 24;
        $paymentMethod = $this->resolvePaymentMethod($vehicle, $data['payment_method'] ?? null);

        return DB::transaction(function () use ($customer, $vehicle, $pickupAt, $returnAt, $quote, $withDriver, $deliveryRequested, $responseHours, $data, $paymentMethod) {
            // The row SaleListingService locks to move a car to sale: whichever runs second sees the other.
            $listingType = DB::table('vehicles')->where('id', $vehicle->id)->lockForUpdate()->value('listing_type');
            abort_unless($listingType === Vehicle::LISTING_RENT, 422, __('This vehicle is not currently available for booking.'));

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
                'payment_method' => $paymentMethod,
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

    /** The customer's pick of paying the shop in cash at pickup or by bank transfer (only if the shop has a bank account). */
    private function resolvePaymentMethod(Vehicle $vehicle, ?string $requested): string
    {
        if ($requested !== Booking::METHOD_BANK_TRANSFER) {
            return Booking::METHOD_CASH;
        }
        if (!$vehicle->shop->primaryBankDetail()->exists()) {
            throw ValidationException::withMessages(['payment_method' => [__('This shop does not accept bank transfers.')]]);
        }

        return Booking::METHOD_BANK_TRANSFER;
    }

    private function assertRequestIsValid(Vehicle $vehicle, VehiclePricing $pricing, Carbon $pickupAt, Carbon $returnAt): void
    {
        abort_unless($vehicle->isPubliclyVisible(), 422, __('This vehicle is not currently available for booking.'));
        abort_unless($vehicle->shop->status === 'active' && $vehicle->shop->is_published, 422, __('This shop is not currently accepting bookings.'));

        if ($returnAt->lessThanOrEqualTo($pickupAt)) {
            throw ValidationException::withMessages(['return_at' => [__('Return date must be after pickup date.')]]);
        }

        if ($pickupAt->lessThan(now()->addHours($pricing->advance_notice_hours))) {
            throw ValidationException::withMessages(['pickup_at' => [__('Pickup must be at least :hours hours from now.', ['hours' => $pricing->advance_notice_hours])]]);
        }

        $days = max(1, (int) ceil($pickupAt->diffInHours($returnAt) / 24));
        if ($days < $pricing->min_rental_days) {
            throw ValidationException::withMessages(['return_at' => [__('Minimum rental is :days day(s).', ['days' => $pricing->min_rental_days])]]);
        }
        if ($pricing->max_rental_days && $days > $pricing->max_rental_days) {
            throw ValidationException::withMessages(['return_at' => [__('Maximum rental is :days day(s).', ['days' => $pricing->max_rental_days])]]);
        }

        $overlap = Booking::where('vehicle_id', $vehicle->id)
            ->whereIn('status', [Booking::STATUS_CONFIRMED, Booking::STATUS_ACTIVE])
            ->where('pickup_at', '<', $returnAt)
            ->where('return_at', '>', $pickupAt)
            ->exists();
        if ($overlap) {
            throw ValidationException::withMessages(['pickup_at' => [__('Vehicle is already booked for part of those dates.')]]);
        }

        $blocked = VehicleAvailability::where('vehicle_id', $vehicle->id)
            ->whereIn('status', [VehicleAvailability::STATUS_BLOCKED, VehicleAvailability::STATUS_MAINTENANCE])
            ->whereBetween('date', [$pickupAt->toDateString(), $returnAt->copy()->subDay()->toDateString()])
            ->exists();
        if ($blocked) {
            throw ValidationException::withMessages(['pickup_at' => [__('Some of those dates are unavailable.')]]);
        }
    }
}
