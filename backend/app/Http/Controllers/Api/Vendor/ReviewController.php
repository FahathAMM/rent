<?php

namespace App\Http\Controllers\Api\Vendor;

use App\Http\Controllers\Controller;
use App\Http\Requests\Review\ReplyReviewRequest;
use App\Models\Review;
use App\Services\AuthUser;
use App\Services\ReviewService;
use App\Support\VendorContext;
use App\Traits\JsonResponse as JsonResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Review has no BelongsToShop/ShopScope, so shop_id is filtered explicitly here, same as OwnerPayout. */
class ReviewController extends Controller
{
    use JsonResponseTrait;

    public function __construct(private ReviewService $service) {}

    public function index(Request $request): JsonResponse
    {
        $sortable = ['rating', 'created_at'];
        $sort = in_array($request->sort_field, $sortable) ? $request->sort_field : 'created_at';
        $dir = $request->sort_direction === 'desc' ? 'desc' : 'asc';

        $reviews = Review::where('shop_id', VendorContext::shopId())
            ->where('status', Review::STATUS_PUBLISHED)
            ->when($request->vehicle_id, fn ($q) => $q->where('vehicle_id', $request->vehicle_id))
            ->when($request->search, fn ($q) => $q->where('comment', 'like', "%{$request->search}%")
                ->orWhereHas('user', fn ($u) => $u->where('name', 'like', "%{$request->search}%"))
                ->orWhereHas('vehicle', fn ($v) => $v->where('title', 'like', "%{$request->search}%")))
            ->with('vehicle:id,title', 'user:id,name')
            ->orderBy($sort, $dir)
            ->paginate(min((int) $request->get('perPage', 20), 100));

        return response()->json(['record' => $reviews, 'message' => 'Reviews retrieved', 'status' => true]);
    }

    public function reply(ReplyReviewRequest $request, Review $review): JsonResponse
    {
        abort_unless($review->shop_id === VendorContext::shopId(), 404);

        $review = $this->service->reply(AuthUser::user(), $review, $request->validated('reply'));

        return $this->response('Reply posted', $review);
    }
}
