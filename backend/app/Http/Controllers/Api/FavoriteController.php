<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\Public\VehicleResource;
use App\Models\Favorite;
use App\Queries\CustomerFavoriteQuery;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * A customer's own favorites - ownership by user_id, no shop context
 * needed, same reasoning as reviews/notifications. {vehicle} is a plain
 * id (never Eloquent route-model-bound) so Vehicle's ShopScope never
 * gets a chance to fail this closed for a customer with no shop context.
 */
class FavoriteController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $favorites = CustomerFavoriteQuery::forUser(auth('customer')->id())
            ->latest('favorites.created_at')
            ->paginate(min((int) $request->get('per_page', 12), 48));

        return response()->json([
            'data' => $favorites->getCollection()->map(fn (Favorite $favorite) => [
                'id' => $favorite->id,
                'created_at' => $favorite->created_at,
                'vehicle' => $favorite->vehicle ? new VehicleResource($favorite->vehicle) : null,
            ]),
            'meta' => [
                'current_page' => $favorites->currentPage(),
                'last_page' => $favorites->lastPage(),
                'total' => $favorites->total(),
            ],
        ]);
    }

    /** Just the saved vehicle ids - lets any page show a filled heart without loading full favorites. */
    public function ids(): JsonResponse
    {
        $ids = Favorite::where('user_id', auth('customer')->id())->pluck('vehicle_id');

        return response()->json(['data' => $ids]);
    }

    public function store(Request $request, int $vehicle): JsonResponse
    {
        abort_unless(DB::table('vehicles')->where('id', $vehicle)->exists(), 404, 'Vehicle not found.');

        $favorite = Favorite::firstOrCreate([
            'user_id' => auth('customer')->id(),
            'vehicle_id' => $vehicle,
        ]);

        return response()->json(['message' => 'Added to favorites', 'data' => ['id' => $favorite->id]], 201);
    }

    public function destroy(Request $request, int $vehicle): JsonResponse
    {
        Favorite::where('user_id', auth('customer')->id())->where('vehicle_id', $vehicle)->delete();

        return response()->json(['message' => 'Removed from favorites']);
    }
}
