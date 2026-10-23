<?php

namespace App\Http\Controllers\Api\Administration;

use App\Http\Controllers\Controller;
use App\Http\Requests\Menu\StoreMenuRequest;
use App\Http\Requests\Menu\UpdateMenuRequest;
use App\Http\Resources\MenuResource;
use App\Models\Administration\Menu;
use App\Repositories\MenuRepo;
use App\Services\AuthUser;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MenuController extends Controller
{
    public function __construct(
        private Menu     $model,
        private MenuRepo $repo,
    ) {}

    /**
     * Returns all menus (flat with pagination) for the management page.
     */
    public function index(Request $request): JsonResponse
    {
        $menus = $this->repo->getData($request);

        // Shape matches UserController@index: the raw paginator under
        // "record", read by ServerDataTable as res.data.record.
        return response()->json([
            'record'  => $menus,
            'message' => 'Menus retrieved successfully',
            'status'  => true,
        ]);
    }

    /**
     * Returns flat list of all active menus (for parent-select dropdowns).
     */
    public function flat(): JsonResponse
    {
        return response()->json([
            'data' => MenuResource::collection($this->repo->getFlat()),
        ]);
    }

    /**
     * Returns the navigation tree for the authenticated user (filtered by permissions).
     */
    public function navigation(): JsonResponse
    {
        $tree = $this->repo->getNavigation(AuthUser::user());

        return response()->json([
            'data' => MenuResource::collection($tree),
        ]);
    }

    public function store(StoreMenuRequest $request): JsonResponse
    {
        $menu = $this->repo->store($request->validated());

        return response()->json([
            'message' => 'Menu created successfully',
            'data'    => new MenuResource($menu),
        ], 201);
    }

    public function update(UpdateMenuRequest $request, Menu $menu): JsonResponse
    {
        $menu = $this->repo->update($menu, $request->validated());

        return response()->json([
            'message' => 'Menu updated successfully',
            'data'    => new MenuResource($menu),
        ]);
    }

    public function destroy(Menu $menu): JsonResponse
    {
        $this->repo->destroy($menu);

        return response()->json(['message' => 'Menu deleted successfully']);
    }
}
