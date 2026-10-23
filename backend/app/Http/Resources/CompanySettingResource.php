<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class CompanySettingResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'invoice_prefix'        => $this->invoice_prefix,
            'expense_prefix'        => $this->expense_prefix,
            'next_invoice_number'   => $this->next_invoice_number,
            'next_expense_number'   => $this->next_expense_number,
            'invoice_footer'        => $this->invoice_footer,
        ];
    }
}
