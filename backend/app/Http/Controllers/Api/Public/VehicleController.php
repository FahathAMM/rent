<?php

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Controller;
use App\Http\Resources\Public\ReviewResource;
use App\Http\Resources\Public\VehicleResource;
use App\Models\Review;
use App\Models\VehicleAvailability;
use App\Queries\PublicVehicleQuery;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Unauthenticated, cacheable reads only - see routes/public.php. Every
 * query here goes through PublicVehicleQuery, the sole sanctioned
 * ShopScope bypass for public consumption.
 */
class VehicleController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $filters = $request->only([
            'q', 'category_id', 'brand_id', 'model_id', 'colour_id', 'district', 'city', 'transmission', 'fuel_type',
            'seats_min', 'delivery', 'price_min', 'price_max', 'sort',
        ]);

        $vehicles = PublicVehicleQuery::search($filters)
            ->paginate(min((int) $request->get('per_page', 12), 48));

        return response()->json([
            'data' => VehicleResource::collection($vehicles),
            'meta' => [
                'current_page' => $vehicles->currentPage(),
                'last_page' => $vehicles->lastPage(),
                'total' => $vehicles->total(),
                'per_page' => $vehicles->perPage(),
            ],
        ]);
    }

    public function show(string $slug): JsonResponse
    {
        $vehicle = PublicVehicleQuery::findBySlug($slug);
        abort_if(!$vehicle, 404, 'Vehicle not found.');

        $vehicle->increment('view_count');

        return response()->json(['data' => new VehicleResource($vehicle)]);
    }

    public function reviews(string $slug): JsonResponse
    {
        $vehicle = PublicVehicleQuery::findBySlug($slug);
        abort_if(!$vehicle, 404, 'Vehicle not found.');

        $reviews = Review::where('vehicle_id', $vehicle->id)
            ->where('status', Review::STATUS_PUBLISHED)
            ->with('user:id,name')
            ->latest()
            ->paginate(10);

        return response()->json(['data' => ReviewResource::collection($reviews)]);
    }

    /**
     * What the booking calendar needs to grey out dates: the days (nights) the
     * vehicle is booked, blocked or in maintenance, plus the earliest pickup
     * date the shop's advance notice allows. Only dates — no booking details.
     * Mirrors BookingService::assertRequestIsValid(): a rental from A to B
     * (10:00 pickup/return) uses the days A … B-1, so B itself may be taken.
     */
    public function availability(string $slug): JsonResponse
    {
        $vehicle = PublicVehicleQuery::findBySlug($slug);
        abort_if(!$vehicle, 404, 'Vehicle not found.');

        $today = now()->startOfDay();
        $until = $today->copy()->addYear();

        $unavailable = VehicleAvailability::where('vehicle_id', $vehicle->id)
            ->whereIn('status', [VehicleAvailability::STATUS_BOOKED, VehicleAvailability::STATUS_BLOCKED, VehicleAvailability::STATUS_MAINTENANCE])
            ->whereBetween('date', [$today->toDateString(), $until->toDateString()])
            ->orderBy('date')
            ->pluck('date')
            ->map(fn ($date) => $date->toDateString())
            ->unique()
            ->values();

        // The booking widget sends a fixed 10:00 pickup; the first day whose 10:00 clears the notice period.
        $noticeEnds = now()->addHours((int) ($vehicle->pricing?->advance_notice_hours ?? 0));
        $earliest = $today->copy()->setTime(10, 0);
        while ($earliest->lessThan($noticeEnds)) {
            $earliest->addDay();
        }

        return response()->json(['data' => [
            'unavailable_dates' => $unavailable,
            'earliest_pickup_date' => $earliest->toDateString(),
            'bookable_until' => $until->toDateString(),
            'min_rental_days' => $vehicle->pricing?->min_rental_days,
            'max_rental_days' => $vehicle->pricing?->max_rental_days,
        ]]);
    }
}
