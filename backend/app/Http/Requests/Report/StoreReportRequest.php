<?php

namespace App\Http\Requests\Report;

use Illuminate\Foundation\Http\FormRequest;

class StoreReportRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'reportable_type' => ['required', 'in:vehicle,review,shop,user'],
            'reportable_id' => ['required', 'integer'],
            'reason' => ['required', 'in:fraud,fake_listing,duplicate_listing,inappropriate_content,spam,unsafe_vehicle,misleading_price,harassment,other'],
            'description' => ['nullable', 'string', 'max:2000'],
        ];
    }
}
