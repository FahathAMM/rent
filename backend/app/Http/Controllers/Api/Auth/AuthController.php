<?php

namespace App\Http\Controllers\Api\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Http\Requests\Auth\UpdateProfileRequest;
use App\Http\Requests\Auth\ChangePasswordRequest;
use App\Http\Resources\UserResource;
use App\Services\AuthService;
use App\Services\AuthUser;
use Illuminate\Http\JsonResponse;

class AuthController extends Controller
{
    public function __construct(private AuthService $authService) {}

    public function login(LoginRequest $request): JsonResponse
    {
        $result = $this->authService->login($request->validated());

        $user = $result['user']->load('roles', 'permissions', 'activeShopMemberships');

        return response()->json([
            'message' => 'Login successful',
            'data' => [
                'user' => new UserResource($user),
                'token' => $result['token'],
            ],
        ]);
    }

    public function register(RegisterRequest $request): JsonResponse
    {
        $result = $this->authService->register($request->validated());

        $user = $result['user']->load('roles', 'permissions');

        return response()->json([
            'message' => 'Registered successfully',
            'data' => [
                'user' => new UserResource($user),
                'token' => $result['token'],
            ],
        ], 201);
    }

    public function logout(): JsonResponse
    {
        $this->authService->logout(AuthUser::user());

        return response()->json(['message' => 'Logged out successfully']);
    }

    public function me(): JsonResponse
    {
        $user = AuthUser::user()->load('roles', 'permissions', 'activeShopMemberships');

        return response()->json(['data' => new UserResource($user)]);
    }

    public function updateProfile(UpdateProfileRequest $request): JsonResponse
    {
        $user = $this->authService->updateProfile(AuthUser::user(), $request);

        return response()->json([
            'message' => 'Profile updated successfully',
            'data' => new UserResource($user->load('roles', 'permissions')),
        ]);
    }

    public function changePassword(ChangePasswordRequest $request): JsonResponse
    {
        $this->authService->changePassword(
            AuthUser::user(),
            $request->current_password,
            $request->new_password
        );

        return response()->json(['message' => 'Password changed successfully']);
    }
}
