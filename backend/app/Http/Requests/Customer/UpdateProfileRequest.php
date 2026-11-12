<?php

namespace App\Http\Requests\Customer;

use App\Models\Customer;
use App\Services\SmsService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class UpdateProfileRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    private function customer(): ?Customer
    {
        $customer = auth('customer')->user();

        return $customer instanceof Customer ? $customer : null;
    }

    /**
     * Phones are stored in one format (94771234567) — the same one registration
     * and phone login use. A number that is really the customer's current one,
     * however it was typed, is put back exactly as stored so it counts as unchanged.
     */
    protected function prepareForValidation(): void
    {
        if (! $this->filled('phone')) {
            return;
        }

        $current = $this->customer()?->phone;
        $typed = SmsService::formatPhone($this->input('phone'));

        if ($current !== null && ($this->input('phone') === $current || ($typed !== null && $typed === SmsService::formatPhone($current)))) {
            $this->merge(['phone' => $current]);

            return;
        }

        $this->merge(['phone' => $typed ?? $this->input('phone')]);
    }

    /** A different, non-empty number than the one on the account. */
    public function phoneIsChanging(): bool
    {
        return $this->filled('phone') && $this->input('phone') !== $this->customer()?->phone;
    }

    public function rules(): array
    {
        $id = $this->customer()?->id;

        return [
            'name'   => 'sometimes|string|max:255',
            'email'  => ['sometimes', 'nullable', 'email', 'max:255', Rule::unique('customers', 'email')->ignore($id)],
            // A new number must be a real, unused mobile number — and proven with the OTP sent to it
            // (CustomerAuthService::updateProfile), since a verified phone is a login identity.
            'phone'  => $this->phoneIsChanging()
                ? ['regex:/^94\d{9}$/', Rule::unique('customers', 'phone')->ignore($id)]
                : ['sometimes', 'nullable', 'string', 'max:20'],
            'otp'    => [Rule::requiredIf($this->phoneIsChanging()), 'nullable', 'digits:6'],
            // Raster formats only — an SVG is a document that can carry scripts, and /storage is served on the app's own origin.
            'avatar' => 'sometimes|nullable|image|mimes:jpg,jpeg,png,webp|max:2048',
        ];
    }

    /** The account must keep a way to sign in: an email, or a verified mobile number. */
    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            $customer = $this->customer();
            if (! $customer || $validator->errors()->isNotEmpty()) {
                return;
            }

            $email = $this->has('email') ? $this->input('email') : $customer->email;
            $phone = $this->has('phone') ? $this->input('phone') : $customer->phone;
            $phoneUsable = filled($phone) && ($this->phoneIsChanging() || $customer->phone_verified_at !== null);

            if (blank($email) && ! $phoneUsable) {
                $validator->errors()->add($this->has('email') ? 'email' : 'phone', 'Keep an email or a verified mobile number on your account.');
            }
        });
    }

    public function messages(): array
    {
        return [
            'phone.regex'  => 'Enter a valid Sri Lankan mobile number.',
            'phone.unique' => 'This mobile number is already registered.',
            'otp.required' => 'Enter the code we sent to your new mobile number.',
        ];
    }
}
