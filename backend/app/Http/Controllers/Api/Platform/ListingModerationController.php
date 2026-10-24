<?php

namespace App\Http\Controllers\Api\Platform;

use App\Http\Controllers\Controller;
use App\Http\Requests\Platform\ReasonRequest;
use App\Models\SystemAdmin;
use App\Models\Vehicle;
use App\Services\ListingModerationService;
use App\Traits\JsonResponse as JsonResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ListingModerationController extends Controller
{
    use JsonResponseTrait;

    public function __construct(private ListingModerationService $service) {}

    public function index(Request $request): JsonResponse
    {
        $vehicles = Vehicle::query()
            ->with([
                'category:id,name',
                'shop:id,name',
                'images' => fn ($q) => $q->where('is_primary', true)->with('attachment'),
            ])
            ->when($request->moderation_status, fn ($q) => $q->where('moderation_status', $request->moderation_status), fn ($q) => $q->where('moderation_status', Vehicle::MODERATION_PENDING))
            ->when($request->search, fn ($q) => $q->where('title', 'like', "%{$request->search}%"))
            ->orderByDesc('created_at')
            ->paginate(min((int) $request->get('perPage', 20), 100));

        return response()->json(['record' => $vehicles, 'message' => 'Listings retrieved', 'status' => true]);
    }

    public function show(Vehicle $vehicle): JsonResponse
    {
        $vehicle->load('category', 'shop.owner:id,name,email', 'pricing', 'images.attachment', 'moderationHistory');

        return $this->response('Listing retrieved', $vehicle);
    }

    public function approve(Vehicle $vehicle): JsonResponse
    {
        return $this->response('Listing approved', $this->service->approve($this->admin(), $vehicle));
    }

    public function reject(ReasonRequest $request, Vehicle $vehicle): JsonResponse
    {
        return $this->response('Listing rejected', $this->service->reject($this->admin(), $vehicle, $request->validated('reason')));
    }

    public function flag(ReasonRequest $request, Vehicle $vehicle): JsonResponse
    {
        return $this->response('Listing flagged', $this->service->flag($this->admin(), $vehicle, $request->validated('reason')));
    }

    public function unpublish(Request $request, Vehicle $vehicle): JsonResponse
    {
        return $this->response('Listing unpublished', $this->service->unpublish($this->admin(), $vehicle, $request->get('reason')));
    }

    public function feature(Vehicle $vehicle): JsonResponse
    {
        return $this->response('Listing featured', $this->service->feature($this->admin(), $vehicle));
    }

    public function unfeature(Vehicle $vehicle): JsonResponse
    {
        return $this->response('Listing unfeatured', $this->service->unfeature($this->admin(), $vehicle));
    }

    private function admin(): SystemAdmin
    {
        /** @var SystemAdmin $admin */
        $admin = auth('platform')->user();

        return $admin;
    }
}
