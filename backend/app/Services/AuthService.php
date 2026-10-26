<?php

namespace App\Services;

use App\Http\Requests\Auth\UpdateProfileRequest;
use App\Models\Administration\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\PersonalAccessToken;

/**
 * Every account starts as a plain customer - see
 * app-doc/marketplace/01-phase1-architecture.md "Identity & ownership
 * model". Becoming a shop owner is a separate onboarding flow (registering
 * a rental shop), not part of registration.
 */
class AuthService
{
    public function login(array $credentials): array
    {
        $user = User::where('email', $credentials['email'])->first();

        if (!$user || !Hash::check($credentials['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        if (!$user->isActive()) {
            throw ValidationException::withMessages([
                'email' => ['Your account is ' . $user->status . '.'],
            ]);
        }

        $user->forceFill(['last_login_at' => now()])->save();

        $token = $user->createToken('marketplace-token', ['*'], now()->addDays(7))->plainTextToken;

        return ['user' => $user, 'token' => $token];
    }

    public function register(array $data): array
    {
        $user = User::create([
            'name'                => $data['name'],
            'email'               => $data['email'],
            'phone'               => $data['phone'] ?? null,
            'password'            => Hash::make($data['password']),
            'status'              => User::STATUS_ACTIVE,
            'registration_source' => 'web',
        ]);

        $user->assignRole('customer');

        $token = $user->createToken('marketplace-token', ['*'], now()->addDays(7))->plainTextToken;

        return ['user' => $user, 'token' => $token];
    }

    public function logout(User $user): void
    {
        $token = $user->currentAccessToken();
        if ($token instanceof PersonalAccessToken) {
            $token->delete();
        }
    }

    public function updateProfile(User $user, UpdateProfileRequest $request): User
    {
        $data = $request->validated();
        unset($data['avatar']);

        if ($request->hasFile('avatar')) {
            if ($user->avatar) {
                Storage::disk('public')->delete($user->avatar);
            }
            $user->imageUpload('avatars', $user, $request->file('avatar'), 'avatar');
        }

        $user->update($data);

        return $user->fresh();
    }

    public function changePassword(User $user, string $currentPassword, string $newPassword): void
    {
        if (!Hash::check($currentPassword, $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => ['The current password is incorrect.'],
            ]);
        }

        $user->update(['password' => $newPassword]);
    }
}
