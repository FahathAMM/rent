<?php

namespace App\Http\Requests\Vendor;

use Illuminate\Foundation\Http\FormRequest;

class BlockAvailabilityRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            // Blocking only matters for days still to come; yesterday is allowed so a late-evening UTC offset never rejects "today".
            'from' => ['required', 'date', 'after_or_equal:yesterday'],
            'to' => ['required', 'date', 'after_or_equal:from'],
            'note' => ['nullable', 'string', 'max:255'],
        ];
    }
}
