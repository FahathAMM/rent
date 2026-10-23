<?php

namespace App\Services;

use App\Models\SystemAdmin;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\PersonalAccessToken;

class PlatformAuthService
{
    public function login(array $credentials): array
    {
        $admin = SystemAdmin::where('email', $credentials['email'])->first();

        if (!$admin || !Hash::check($credentials['password'], $admin->password)) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        if (!$admin->isActive()) {
            throw ValidationException::withMessages([
                'email' => ['Your platform admin account has been deactivated.'],
            ]);
        }

        $admin->forceFill(['last_login_at' => now()])->save();

        $token = $admin->createToken('platform-token', ['*'], now()->addDays(1))->plainTextToken;

        return ['admin' => $admin, 'token' => $token];
    }

    public function logout(SystemAdmin $admin): void
    {
        $token = $admin->currentAccessToken();
        if ($token instanceof PersonalAccessToken) {
            $token->delete();
        }
    }
}
