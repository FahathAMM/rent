<?php

namespace App\Http\Requests\Platform;

use Illuminate\Foundation\Http\FormRequest;

class ActionReportRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'status' => ['required', 'in:reviewing,actioned,dismissed'],
            'action_taken' => ['nullable', 'string', 'max:255'],
            'internal_note' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
