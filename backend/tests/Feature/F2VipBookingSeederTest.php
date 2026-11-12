<?php

namespace Tests\Feature;

use App\Models\Booking;
use App\Models\Payment;
use App\Models\RentalShop;
use App\Models\Review;
use App\Models\Vehicle;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** The demo seeder: 50 bookings whose statements, deposits and reviews follow the real booking flow. */
class F2VipBookingSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_seeds_50_consistent_bookings_with_payments_and_reviews(): void
    {
        // The seeder validates every booking itself and throws on any mismatch.
        $this->seed(DatabaseSeeder::class);

        $shop = RentalShop::where('slug', 'f2-vip-rental')->firstOrFail();
        $bookings = Booking::withoutGlobalScopes()->where('shop_id', $shop->id)->with(['payments', 'pricing', 'review'])->get();

        $this->assertCount(50, $bookings);
        $this->assertCount(18, $bookings->where('status', Booking::STATUS_COMPLETED));

        foreach ($bookings->where('status', Booking::STATUS_COMPLETED) as $booking) {
            $this->assertSame(Booking::PAYMENT_PAID, $booking->payment_status);
            $this->assertEquals(0, $booking->balanceDue(), $booking->booking_reference);
        }

        foreach ($bookings->whereIn('status', [Booking::STATUS_PENDING, Booking::STATUS_REJECTED, Booking::STATUS_EXPIRED]) as $booking) {
            $this->assertTrue($booking->payments->isEmpty(), $booking->booking_reference);
        }

        $this->assertTrue($bookings->whereNotIn('status', [Booking::STATUS_COMPLETED])->every(fn ($b) => $b->review === null));
        $this->assertGreaterThan(0, Review::whereIn('booking_id', $bookings->pluck('id'))->count());
        $this->assertGreaterThan(0, Payment::whereIn('booking_id', $bookings->pluck('id'))->whereNotNull('method')->count());

        // Vehicle stats line up with the seeded completed trips and published reviews.
        $vehicle = Vehicle::withoutGlobalScopes()->whereKey($bookings->firstWhere('status', Booking::STATUS_COMPLETED)->vehicle_id)->first();
        $this->assertSame(
            $bookings->where('vehicle_id', $vehicle->id)->where('status', Booking::STATUS_COMPLETED)->count(),
            (int) $vehicle->booking_count,
        );
        $this->assertSame(
            Review::where('vehicle_id', $vehicle->id)->where('status', Review::STATUS_PUBLISHED)->count(),
            (int) $vehicle->rating_count,
        );
    }
}
