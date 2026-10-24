<?php

namespace App\Http\Controllers\Api\Platform;

use App\Http\Controllers\Controller;
use App\Http\Requests\Platform\ReasonRequest;
use App\Models\Review;
use App\Models\SystemAdmin;
use App\Services\ReviewService;
use App\Traits\JsonResponse as JsonResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReviewController extends Controller
{
    use JsonResponseTrait;

    public function __construct(private ReviewService $service) {}

    public function index(Request $request): JsonResponse
    {
        $reviews = Review::with('vehicle:id,title', 'shop:id,name', 'user:id,name,email')
            ->when($request->status, fn ($q) => $q->where('status', $request->status), fn ($q) => $q->where('status', Review::STATUS_PENDING))
            ->orderByDesc('created_at')
            ->paginate(min((int) $request->get('perPage', 20), 100));

        return response()->json(['record' => $reviews, 'message' => 'Reviews retrieved', 'status' => true]);
    }

    public function publish(Review $review): JsonResponse
    {
        return $this->response('Review published', $this->service->publish($this->admin(), $review));
    }

    public function reject(ReasonRequest $request, Review $review): JsonResponse
    {
        return $this->response('Review rejected', $this->service->reject($this->admin(), $review, $request->validated('reason')));
    }

    public function hide(ReasonRequest $request, Review $review): JsonResponse
    {
        return $this->response('Review hidden', $this->service->hide($this->admin(), $review, $request->validated('reason')));
    }

    private function admin(): SystemAdmin
    {
        /** @var SystemAdmin $admin */
        $admin = auth('platform')->user();

        return $admin;
    }
}
