<?php

namespace App\Http\Requests\Customer;

use App\Services\SmsService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;

class RegisterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // public endpoint
    }

    /** Store phones in one format (94771234567) so "unique" and phone login work. */
    protected function prepareForValidation(): void
    {
        if ($this->filled('phone')) {
            $this->merge(['phone' => SmsService::formatPhone($this->phone) ?? $this->phone]);
        }
    }

    /** Register with an email, a mobile number, or both. A mobile number needs the OTP we sent to it. */
    public function rules(): array
    {
        return [
            'name'     => ['required', 'string', 'max:255'],
            'email'    => ['nullable', 'required_without:phone', 'email', 'max:255', 'unique:customers,email'],
            'phone'    => ['nullable', 'required_without:email', 'regex:/^94\d{9}$/', 'unique:customers,phone'],
            'otp'      => ['required_with:phone', 'nullable', 'digits:6'],
            'password' => ['required', 'confirmed', Password::min(8)],
            'terms_accepted' => ['accepted'],
        ];
    }

    public function messages(): array
    {
        return [
            'terms_accepted.accepted' => 'Please agree to the Terms & Conditions and Privacy Policy to continue.',
            'email.required_without'  => 'Enter your email or mobile number.',
            'phone.required_without'  => 'Enter your email or mobile number.',
            'phone.regex'             => 'Enter a valid Sri Lankan mobile number.',
            'otp.required_with'       => 'Enter the code we sent to your mobile.',
        ];
    }
}
