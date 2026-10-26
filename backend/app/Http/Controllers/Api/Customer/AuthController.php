<?php

namespace App\Http\Controllers\Api\Customer;

use App\Http\Controllers\Controller;
use App\Http\Requests\Customer\ChangePasswordRequest;
use App\Http\Requests\Customer\LoginRequest;
use App\Http\Requests\Customer\RegisterRequest;
use App\Http\Requests\Customer\UpdateProfileRequest;
use App\Http\Resources\CustomerResource;
use App\Models\Customer;
use App\Services\CustomerAuthService;
use Illuminate\Http\JsonResponse;

class AuthController extends Controller
{
    public function __construct(private CustomerAuthService $authService) {}

    public function login(LoginRequest $request): JsonResponse
    {
        $result = $this->authService->login($request->validated());

        return response()->json([
            'message' => 'Login successful',
            'data' => [
                'customer' => new CustomerResource($result['customer']),
                'token' => $result['token'],
            ],
        ]);
    }

    public function register(RegisterRequest $request): JsonResponse
    {
        $result = $this->authService->register($request->validated());

        return response()->json([
            'message' => 'Registered successfully',
            'data' => [
                'customer' => new CustomerResource($result['customer']),
                'token' => $result['token'],
            ],
        ], 201);
    }

    public function logout(): JsonResponse
    {
        /** @var Customer $customer */
        $customer = auth('customer')->user();
        $this->authService->logout($customer);

        return response()->json(['message' => 'Logged out successfully']);
    }

    public function me(): JsonResponse
    {
        return response()->json(['data' => new CustomerResource(auth('customer')->user())]);
    }

    public function updateProfile(UpdateProfileRequest $request): JsonResponse
    {
        $customer = $this->authService->updateProfile(auth('customer')->user(), $request);

        return response()->json([
            'message' => 'Profile updated successfully',
            'data' => new CustomerResource($customer),
        ]);
    }

    public function changePassword(ChangePasswordRequest $request): JsonResponse
    {
        $this->authService->changePassword(
            auth('customer')->user(),
            $request->current_password,
            $request->new_password
        );

        return response()->json(['message' => 'Password changed successfully']);
    }
}
