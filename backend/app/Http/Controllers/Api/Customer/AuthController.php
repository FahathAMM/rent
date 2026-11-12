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
use App\Services\SmsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuthController extends Controller
{
    public function __construct(private CustomerAuthService $authService) {}

    public function login(LoginRequest $request): JsonResponse
    {
        $result = $this->authService->login($request->validated());

        return response()->json([
            'message' => __('Login successful'),
            'data' => [
                'customer' => new CustomerResource($result['customer']),
                'token' => $result['token'],
            ],
        ]);
    }

    /** Step 1 of registering with a mobile number: text a 6-digit code to it. */
    public function sendOtp(Request $request): JsonResponse
    {
        $request->merge(['phone' => SmsService::formatPhone($request->phone) ?? $request->phone]);
        $request->validate(
            ['phone' => ['required', 'regex:/^94\d{9}$/', 'unique:customers,phone']],
            ['phone.regex' => 'Enter a valid Sri Lankan mobile number.', 'phone.unique' => 'This mobile number is already registered.'],
        );

        $this->authService->sendOtp($request->phone);

        return response()->json(['message' => __('Code sent to your mobile')]);
    }

    public function register(RegisterRequest $request): JsonResponse
    {
        $result = $this->authService->register($request->validated());

        return response()->json([
            'message' => __('Registered successfully'),
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

        return response()->json(['message' => __('Logged out successfully')]);
    }

    public function me(): JsonResponse
    {
        return response()->json(['data' => new CustomerResource(auth('customer')->user())]);
    }

    public function updateProfile(UpdateProfileRequest $request): JsonResponse
    {
        $customer = $this->authService->updateProfile(auth('customer')->user(), $request);

        return response()->json([
            'message' => __('Profile updated successfully'),
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

        return response()->json(['message' => __('Password changed successfully')]);
    }
}
