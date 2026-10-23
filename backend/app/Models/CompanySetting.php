<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CompanySetting extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_id',
        'invoice_prefix', 'expense_prefix',
        'next_invoice_number', 'next_expense_number',
        'branch_prefix', 'next_branch_number',
        'purchase_prefix', 'next_purchase_number',
        'invoice_footer',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }
}
