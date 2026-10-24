<?php

namespace App\Http\Requests\Platform;

use Illuminate\Foundation\Http\FormRequest;

class ResolveDisputeRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'resolution' => ['required', 'string', 'max:5000'],
            'resolution_amount' => ['nullable', 'numeric', 'min:0'],
            'resolution_in_favour_of' => ['required', 'in:customer,owner,split,none'],
            'close' => ['nullable', 'boolean'],
        ];
    }
}
