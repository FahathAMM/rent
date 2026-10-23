<?php

namespace App\Http\Controllers\Api\Platform;

use App\Http\Controllers\Controller;
use App\Http\Requests\Platform\StorePlanRequest;
use App\Http\Requests\Platform\UpdatePlanRequest;
use App\Http\Resources\Platform\PlanResource;
use App\Models\Administration\AuditLog;
use App\Models\Plan;
use Illuminate\Http\JsonResponse;

class PlanController extends Controller
{
    public function index(): JsonResponse
    {
        $plans = Plan::withCount('subscriptions')->orderBy('sort_order')->get();

        $this->audit('view', null, '');

        return response()->json(['data' => PlanResource::collection($plans)]);
    }

    public function store(StorePlanRequest $request): JsonResponse
    {
        $plan = Plan::create($request->validated());

        $this->audit('create', $plan->id, $plan->name);

        return response()->json([
            'message' => 'Plan created successfully',
            'data'    => new PlanResource($plan),
        ], 201);
    }

    public function update(UpdatePlanRequest $request, Plan $plan): JsonResponse
    {
        $plan->update($request->validated());

        $this->audit('edit', $plan->id, $plan->name);

        return response()->json([
            'message' => 'Plan updated successfully',
            'data'    => new PlanResource($plan->fresh()),
        ]);
    }

    public function destroy(Plan $plan): JsonResponse
    {
        if ($plan->subscriptions()->exists()) {
            return response()->json([
                'message' => 'This plan has active or historical subscriptions and cannot be deleted. Deactivate it instead.',
            ], 422);
        }

        $recordName = $plan->name;

        $plan->delete();

        $this->audit('delete', $plan->id, $recordName);

        return response()->json(['message' => 'Plan deleted successfully']);
    }

    private function audit(string $action, ?int $recordId, string $record): void
    {
        AuditLog::create([
            'system_admin_id' => auth('platform')->id(),
            'action'          => $action,
            'form'            => 'Plan',
            'record_id'       => $recordId,
            'record'          => $record,
            'ip'              => request()->ip(),
            'browser'         => request()->userAgent(),
        ]);
    }
}
