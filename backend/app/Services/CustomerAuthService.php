<?php

namespace App\Services;

use App\Http\Requests\Customer\UpdateProfileRequest;
use App\Models\Customer;
use Illuminate\Support\Facades\Cache;
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
    public function __construct(private SmsService $sms) {}

    public function login(array $credentials): array
    {
        // The "email" field may hold an email or a mobile number.
        $login = $credentials['email'];
        if (str_contains($login, '@')) {
            $customer = Customer::where('email', $login)->first();
        } else {
            // Not a mobile number at all → no lookup: where('phone', null) would match accounts with no phone.
            $phone = SmsService::formatPhone($login);
            $customer = $phone ? Customer::where('phone', $phone)->whereNotNull('phone_verified_at')->first() : null;
        }

        if (!$customer || !Hash::check($credentials['password'], $customer->password)) {
            throw ValidationException::withMessages([
                'email' => [__('The provided credentials are incorrect.')],
            ]);
        }

        if (!$customer->isActive()) {
            throw ValidationException::withMessages([
                'email' => [__('Your account is :status.', ['status' => __($customer->status)])],
            ]);
        }

        $customer->forceFill(['last_login_at' => now()])->save();

        $token = $customer->createToken('customer-token', ['*'], now()->addDays(7))->plainTextToken;

        return ['customer' => $customer, 'token' => $token];
    }

    /** Sends a 6-digit code to the phone. Valid for 5 minutes. */
    public function sendOtp(string $phone): void
    {
        $code = (string) random_int(100000, 999999);

        Cache::put("customer-otp:{$phone}", ['code' => $code, 'attempts' => 0], now()->addMinutes(5));

        $sent = $this->sms->send($phone, config('app.name') . " verification code: {$code}. It expires in 5 minutes.");

        if (! $sent) {
            throw ValidationException::withMessages(['phone' => [__('Could not send the code. Please try again.')]]);
        }
    }

    /** Throws unless $code is the code we sent to $phone. Five wrong tries and the code is gone. */
    private function checkOtp(string $phone, string $code): void
    {
        $key = "customer-otp:{$phone}";
        $otp = Cache::get($key);

        if (! $otp || $otp['attempts'] >= 5) {
            Cache::forget($key);
            throw ValidationException::withMessages(['otp' => [__('The code has expired. Please request a new one.')]]);
        }

        if (! hash_equals($otp['code'], $code)) {
            $otp['attempts']++;
            Cache::put($key, $otp, now()->addMinutes(5));
            throw ValidationException::withMessages(['otp' => [__('The code is incorrect.')]]);
        }

        Cache::forget($key);
    }

    public function register(array $data): array
    {
        $phone = $data['phone'] ?? null;
        if ($phone) {
            $this->checkOtp($phone, $data['otp']);
        }

        $customer = Customer::create([
            'name'                => $data['name'],
            'email'               => $data['email'] ?? null,
            'phone'               => $phone,
            'phone_verified_at'   => $phone ? now() : null,
            'password'            => Hash::make($data['password']),
            'status'              => Customer::STATUS_ACTIVE,
            'registration_source' => 'web',
            'terms_accepted_at'   => now(),
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
        unset($data['avatar'], $data['otp']);

        // A verified phone is a login identity, so a new number only goes on the
        // account once its owner proves it with the OTP we sent there.
        if (array_key_exists('phone', $data) && $data['phone'] !== $customer->phone) {
            if ($data['phone'] === null) {
                $data['phone_verified_at'] = null;
            } else {
                $this->checkOtp($data['phone'], (string) $request->validated('otp'));
                $data['phone_verified_at'] = now();
            }
        }

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
                'current_password' => [__('The current password is incorrect.')],
            ]);
        }

        $customer->update(['password' => $newPassword]);

        // Sign out every other session — whoever may have had the old password loses access now.
        $current = $customer->currentAccessToken();
        $customer->tokens()->when($current instanceof PersonalAccessToken, fn ($q) => $q->whereKeyNot($current->id))->delete();
    }
}
