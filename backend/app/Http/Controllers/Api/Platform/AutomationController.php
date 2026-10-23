<?php

namespace App\Http\Controllers\Api\Platform;

use App\Http\Controllers\Controller;
use App\Http\Requests\Platform\StoreAutomationRequest;
use App\Http\Requests\Platform\UpdateAutomationRequest;
use App\Http\Resources\Platform\AutomationResource;
use App\Models\Administration\AuditLog;
use App\Models\Automation;
use Illuminate\Http\JsonResponse;

/** Platform-admin-managed scheduled tasks (name, cadence, on/off) — /platform/settings "Automations". */
class AutomationController extends Controller
{
    public function index(): JsonResponse
    {
        $automations = Automation::orderBy('name')->get();

        return response()->json(['data' => AutomationResource::collection($automations)]);
    }

    public function store(StoreAutomationRequest $request): JsonResponse
    {
        $automation = Automation::create($request->validated());

        $this->audit('create', $automation->id, $automation->name);

        return response()->json([
            'message' => 'Automation created successfully',
            'data'    => new AutomationResource($automation),
        ], 201);
    }

    public function update(UpdateAutomationRequest $request, Automation $automation): JsonResponse
    {
        $automation->update($request->validated());

        $this->audit('edit', $automation->id, $automation->name);

        return response()->json([
            'message' => 'Automation updated successfully',
            'data'    => new AutomationResource($automation->fresh()),
        ]);
    }

    public function destroy(Automation $automation): JsonResponse
    {
        $recordName = $automation->name;

        $automation->delete();

        $this->audit('delete', $automation->id, $recordName);

        return response()->json(['message' => 'Automation deleted successfully']);
    }

    private function audit(string $action, ?int $recordId, string $record): void
    {
        AuditLog::create([
            'system_admin_id' => auth('platform')->id(),
            'action'          => $action,
            'form'            => 'Automation',
            'record_id'       => $recordId,
            'record'          => $record,
            'ip'              => request()->ip(),
            'browser'         => request()->userAgent(),
        ]);
    }
}
