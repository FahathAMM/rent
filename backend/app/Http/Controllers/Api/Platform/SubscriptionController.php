<?php

namespace App\Http\Controllers\Api\Platform;

use App\Http\Controllers\Controller;
use App\Http\Resources\Platform\PlatformSubscriptionResource;
use App\Models\Subscription;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SubscriptionController extends Controller
{
    /** Shape matches Platform\ActivityController@index: the raw paginator under "record", read by ServerDataTable as res.data.record. */
    public function index(Request $request): JsonResponse
    {
        $query = Subscription::query()->with(['company:id,name', 'plan:id,name,slug']);

        if ($companyId = $request->get('company_id')) {
            $query->where('company_id', $companyId);
        }

        if ($status = $request->get('status')) {
            $query->where('status', $status);
        }

        if ($planId = $request->get('plan_id')) {
            $query->where('plan_id', $planId);
        }

        if ($search = $request->get('search')) {
            $query->whereHas('company', fn ($c) => $c->where('name', 'like', "%{$search}%"));
        }

        $sortable = ['created_at', 'starts_at', 'ends_at'];
        $sort = in_array($request->get('sort_field'), $sortable) ? $request->get('sort_field') : 'created_at';
        $dir = $request->get('sort_direction') === 'asc' ? 'asc' : 'desc';
        $query->orderBy($sort, $dir);

        $subscriptions = $query->paginate((int) $request->get('perPage', 20));
        $subscriptions->through(fn (Subscription $subscription) => (new PlatformSubscriptionResource($subscription))->resolve());

        return response()->json([
            'record'  => $subscriptions,
            'message' => 'Subscriptions retrieved successfully',
            'status'  => true,
        ]);
    }
}
