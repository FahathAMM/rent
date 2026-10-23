<?php

namespace App\Services;

use App\Http\Requests\Auth\UpdateProfileRequest;
use App\Models\Administration\User;
use App\Models\Company;
use App\Models\CompanySetting;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\PersonalAccessToken;

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

        if (!$user->is_active) {
            throw ValidationException::withMessages([
                'email' => ['Your account has been deactivated.'],
            ]);
        }

        // `initiate` (awaiting Platform Admin activation) can still log in —
        // they land on the account-pending page instead of the dashboard
        // (see EnsureCompanyActivated). Only a company an admin has actually
        // suspended/deactivated blocks login outright.
        if ($user->company_id && in_array($user->company?->status, ['inactive', 'suspended'], true)) {
            throw ValidationException::withMessages([
                'email' => ['Your company account is currently ' . $user->company->status . '.'],
            ]);
        }

        $token = $user->createToken('pos-token', ['*'], now()->addDays(7))->plainTextToken;

        return ['user' => $user, 'token' => $token];
    }

    /**
     * Registration flow: company → owner account → login. Public sign-up
     * starts locked out of the app until a Platform Admin activates it (see
     * EnsureCompanyActivated) — no subscription/plan is created here.
     *
     * Inline on purpose: this project avoids Action classes; the previous
     * App\Actions\CreateCompanyAction this used to delegate to never
     * actually existed in the repo.
     */
    public function register(array $data): array
    {
        [$user, $company] = DB::transaction(function () use ($data) {
            $company = Company::create([
                'name'   => $data['company_name'],
                'status' => 'initiate',
            ]);

            CompanySetting::create(['company_id' => $company->id]);

            $user = User::create([
                'company_id' => $company->id,
                'name'       => $data['name'],
                'email'      => $data['email'],
                'phone'      => $data['phone'] ?? null,
                'password'   => Hash::make($data['password']),
                'is_active'  => true,
            ]);

            $user->syncRoles(['owner']);

            return [$user, $company];
        });

        $token = $user->createToken('pos-token', ['*'], now()->addDays(7))->plainTextToken;

        return ['user' => $user, 'token' => $token, 'company' => $company];
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
