<?php

namespace App\Http\Controllers\Api\Platform;

use App\Http\Controllers\Controller;
use App\Http\Requests\Platform\StoreSystemAdminRequest;
use App\Http\Requests\Platform\UpdateSystemAdminRequest;
use App\Http\Resources\Platform\SystemAdminResource;
use App\Models\Administration\AuditLog;
use App\Models\SystemAdmin;
use Illuminate\Http\JsonResponse;

/** Manages Platform Owner/Platform Admin accounts themselves — the /platform/users page. */
class SystemAdminController extends Controller
{
    public function index(): JsonResponse
    {
        $admins = SystemAdmin::orderBy('name')->get();

        $this->audit('view', null, '');

        return response()->json(['data' => SystemAdminResource::collection($admins)]);
    }

    public function store(StoreSystemAdminRequest $request): JsonResponse
    {
        abort_unless(auth('platform')->user()?->isOwner(), 403);

        // refresh() so DB defaults (e.g. is_active) are in the response, not null.
        $admin = SystemAdmin::create($request->validated())->refresh();

        $this->audit('create', $admin->id, $admin->name);

        return response()->json([
            'message' => 'Platform admin created successfully',
            'data'    => new SystemAdminResource($admin),
        ], 201);
    }

    public function update(UpdateSystemAdminRequest $request, SystemAdmin $systemAdmin): JsonResponse
    {
        abort_unless(auth('platform')->user()?->isOwner(), 403);

        $data = $request->validated();
        if (empty($data['password'])) {
            unset($data['password']);
        }

        // The owner can't lock themselves out by deactivating their own account.
        abort_if(
            (int) $systemAdmin->id === (int) auth('platform')->id() && $request->has('is_active') && !$request->boolean('is_active'),
            422,
            'You cannot deactivate your own account.'
        );

        $systemAdmin->update($data);

        // A password reset or deactivation signs that admin out everywhere — their
        // existing tokens must not keep working with the old credentials.
        if (isset($data['password']) || ($request->has('is_active') && !$request->boolean('is_active'))) {
            $systemAdmin->tokens()->delete();
        }

        $this->audit('edit', $systemAdmin->id, $systemAdmin->name);

        return response()->json([
            'message' => 'Platform admin updated successfully',
            'data'    => new SystemAdminResource($systemAdmin->fresh()),
        ]);
    }

    public function destroy(SystemAdmin $systemAdmin): JsonResponse
    {
        $admin = auth('platform')->user();
        abort_unless($admin?->isOwner() && $admin->id !== $systemAdmin->id, 403);

        $recordName = $systemAdmin->name;

        $systemAdmin->delete();

        $this->audit('delete', $systemAdmin->id, $recordName);

        return response()->json(['message' => 'Platform admin deleted successfully']);
    }

    private function audit(string $action, ?int $recordId, string $record): void
    {
        AuditLog::create([
            'system_admin_id' => auth('platform')->id(),
            'action'          => $action,
            'form'            => 'SystemAdmin',
            'record_id'       => $recordId,
            'record'          => $record,
            'ip'              => request()->ip(),
            'browser'         => request()->userAgent(),
        ]);
    }
}
