<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Review\StoreReviewRequest;
use App\Models\Review;
use App\Queries\CustomerBookingQuery;
use App\Services\AuditService;
use App\Services\ReviewService;
use App\Traits\JsonResponse as JsonResponseTrait;
use Illuminate\Http\JsonResponse;

/**
 * Customer's own reviews - a booking's reviewability is checked against
 * CustomerBookingQuery (the sanctioned ShopScope-bypass for a customer's
 * own bookings, which legitimately span multiple shops), never a bare
 * Booking::find().
 */
class ReviewController extends Controller
{
    use JsonResponseTrait;

    public function __construct(private ReviewService $service) {}

    public function index(): JsonResponse
    {
        $reviews = Review::where('user_id', auth('customer')->id())
            ->with('vehicle:id,title,slug')
            ->orderByDesc('created_at')
            ->paginate(10);

        return response()->json(['record' => $reviews, 'message' => 'Reviews retrieved', 'status' => true]);
    }

    public function store(StoreReviewRequest $request): JsonResponse
    {
        $booking = CustomerBookingQuery::find(auth('customer')->id(), $request->validated('booking_reference'));
        abort_unless($booking, 404);

        $review = $this->service->create(auth('customer')->user(), $booking, $request->safe()->except('booking_reference'));

        AuditService::create('Review', $review->id, "Review for {$booking->booking_reference}");

        return $this->response('Review submitted — it will appear once moderated', $review, 201);
    }
}
