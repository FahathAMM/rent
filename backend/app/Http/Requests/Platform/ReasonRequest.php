<?php

namespace App\Http\Requests\Platform;

use Illuminate\Foundation\Http\FormRequest;

/** Shared by every reject/suspend/request-info admin action that needs one free-text reason. */
class ReasonRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return ['reason' => ['required', 'string', 'max:1000']];
    }
}
