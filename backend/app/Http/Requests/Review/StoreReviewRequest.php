<?php

namespace App\Http\Requests\Review;

use Illuminate\Foundation\Http\FormRequest;

class StoreReviewRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'booking_reference' => ['required', 'string'],
            'rating' => ['required', 'integer', 'min:1', 'max:5'],
            'rating_cleanliness' => ['nullable', 'integer', 'min:1', 'max:5'],
            'rating_condition' => ['nullable', 'integer', 'min:1', 'max:5'],
            'rating_value' => ['nullable', 'integer', 'min:1', 'max:5'],
            'rating_communication' => ['nullable', 'integer', 'min:1', 'max:5'],
            'rating_accuracy' => ['nullable', 'integer', 'min:1', 'max:5'],
            'title' => ['nullable', 'string', 'max:255'],
            'comment' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
