<?php

namespace App\Http\Requests\Platform;

use Illuminate\Foundation\Http\FormRequest;

class UpdatePlanRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        $id = $this->route('plan')?->id;

        return [
            'name'           => 'sometimes|required|string|max:255',
            'slug'           => "sometimes|required|string|max:100|alpha_dash|unique:plans,slug,{$id}",
            'monthly_price'  => 'sometimes|required|numeric|min:0',
            'yearly_price'   => 'nullable|numeric|min:0',
            'max_users'      => 'nullable|integer|min:1',
            'max_customers'  => 'nullable|integer|min:1',
            'max_invoices'   => 'nullable|integer|min:1',
            'trial_days'     => 'sometimes|required|integer|min:0',
            'status'         => 'sometimes|required|in:active,inactive',
            'sort_order'     => 'nullable|integer|min:0',
            'disabled_modules'   => 'nullable|array',
            'disabled_modules.*' => 'string|in:accounting',
        ];
    }
}
