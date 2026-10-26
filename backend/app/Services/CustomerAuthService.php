<?php

namespace App\Services;

use App\Http\Requests\Customer\UpdateProfileRequest;
use App\Models\Customer;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\PersonalAccessToken;

/**
 * Mirrors AuthService, but for the separate `customer` guard/table — see
 * App\Models\Customer's docblock. No role assignment anywhere: a customer
 * has no role.
 */
class CustomerAuthService
{
    public function login(array $credentials): array
    {
        $customer = Customer::where('email', $credentials['email'])->first();

        if (!$customer || !Hash::check($credentials['password'], $customer->password)) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        if (!$customer->isActive()) {
            throw ValidationException::withMessages([
                'email' => ['Your account is ' . $customer->status . '.'],
            ]);
        }

        $customer->forceFill(['last_login_at' => now()])->save();

        $token = $customer->createToken('customer-token', ['*'], now()->addDays(7))->plainTextToken;

        return ['customer' => $customer, 'token' => $token];
    }

    public function register(array $data): array
    {
        $customer = Customer::create([
            'name'                => $data['name'],
            'email'               => $data['email'],
            'phone'               => $data['phone'] ?? null,
            'password'            => Hash::make($data['password']),
            'status'              => Customer::STATUS_ACTIVE,
            'registration_source' => 'web',
        ]);

        $token = $customer->createToken('customer-token', ['*'], now()->addDays(7))->plainTextToken;

        return ['customer' => $customer, 'token' => $token];
    }

    public function logout(Customer $customer): void
    {
        $token = $customer->currentAccessToken();
        if ($token instanceof PersonalAccessToken) {
            $token->delete();
        }
    }

    public function updateProfile(Customer $customer, UpdateProfileRequest $request): Customer
    {
        $data = $request->validated();
        unset($data['avatar']);

        if ($request->hasFile('avatar')) {
            if ($customer->avatar) {
                Storage::disk('public')->delete($customer->avatar);
            }
            $customer->imageUpload('avatars', $customer, $request->file('avatar'), 'avatar');
        }

        $customer->update($data);

        return $customer->fresh();
    }

    public function changePassword(Customer $customer, string $currentPassword, string $newPassword): void
    {
        if (!Hash::check($currentPassword, $customer->password)) {
            throw ValidationException::withMessages([
                'current_password' => ['The current password is incorrect.'],
            ]);
        }

        $customer->update(['password' => $newPassword]);
    }
}
