<?php

namespace App\Http\Controllers\Api\Platform;

use App\Http\Controllers\Controller;
use App\Http\Requests\Platform\ImpersonationStartRequest;
use App\Http\Requests\Platform\ImpersonationStopRequest;
use App\Http\Resources\UserResource;
use App\Models\Administration\User;
use App\Models\SystemAdmin;
use App\Services\ImpersonationService;
use Illuminate\Http\JsonResponse;

class ImpersonationController extends Controller
{
    public function __construct(private ImpersonationService $impersonation) {}

    public function start(ImpersonationStartRequest $request): JsonResponse
    {
        /** @var SystemAdmin $admin */
        $admin = auth('platform')->user();

        $targetUser = User::findOrFail($request->validated('user_id'));

        $result = $this->impersonation->start($admin, $targetUser, $request);

        return response()->json([
            'message' => "Impersonation started for {$targetUser->name}.",
            'data' => [
                'token'      => $result['token'],
                'session_id' => $result['session']->id,
                'user'       => new UserResource($targetUser->load('roles', 'permissions')),
            ],
        ]);
    }

    public function stop(ImpersonationStopRequest $request): JsonResponse
    {
        /** @var SystemAdmin $admin */
        $admin = auth('platform')->user();

        $session = $this->impersonation->stop($admin, (int) $request->validated('session_id'), $request);

        return response()->json([
            'message' => 'Impersonation session ended.',
            'data'    => [
                'session_id' => $session->id,
                'ended_at'   => $session->ended_at?->toISOString(),
            ],
        ]);
    }
}
