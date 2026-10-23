<?php

namespace App\Http\Controllers\Api\Platform;

use App\Http\Controllers\Controller;
use App\Http\Requests\Platform\PlatformLoginRequest;
use App\Http\Resources\Platform\SystemAdminResource;
use App\Models\SystemAdmin;
use App\Services\PlatformAuthService;
use Illuminate\Http\JsonResponse;

class AuthController extends Controller
{
    public function __construct(private PlatformAuthService $authService) {}

    public function login(PlatformLoginRequest $request): JsonResponse
    {
        $result = $this->authService->login($request->validated());

        return response()->json([
            'message' => 'Login successful',
            'data' => [
                'admin' => new SystemAdminResource($result['admin']),
                'token' => $result['token'],
            ],
        ]);
    }

    public function logout(): JsonResponse
    {
        /** @var SystemAdmin $admin */
        $admin = auth('platform')->user();
        $this->authService->logout($admin);

        return response()->json(['message' => 'Logged out successfully']);
    }

    public function me(): JsonResponse
    {
        return response()->json(['data' => new SystemAdminResource(auth('platform')->user())]);
    }
}
