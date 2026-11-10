<?php

namespace App\Http\Requests\Sale;

use App\Models\VehicleSale;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class RecordVehicleSaleRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'enquiry_reference' => ['nullable', 'string', 'max:30'],
            'buyer_name' => ['required', 'string', 'max:255'],
            'buyer_phone' => ['required', 'string', 'max:30'],
            'buyer_nic' => ['required', 'string', 'max:20'],
            'buyer_address' => ['nullable', 'string', 'max:1000'],
            'sale_price' => ['required', 'numeric', 'min:1', 'max:999999999999'],
            'payment_method' => ['required', Rule::in(VehicleSale::PAYMENT_METHODS)],
            'sold_at' => ['nullable', 'date', 'before_or_equal:now'],
            'customer_signature' => ['nullable', 'string', 'max:1500000'],
            'terms_accepted' => ['boolean'],
        ];
    }
}
