<?php

namespace App\Policies;

use App\Models\Administration\User;
use App\Models\OwnerBankDetail;
use App\Support\ShopGate;
use App\Support\VendorContext;

/**
 * Bank details are owner-only: roles the owner creates can never include
 * vendor-finance-bank_details-* (Role::OWNER_ONLY_PREFIXES), so staff cannot
 * read or change where customers' transfers go. account_number itself is never serialized (see
 * OwnerBankDetail::$hidden) regardless of who passes this check.
 */
class OwnerBankDetailPolicy
{
    public function view(User $user, OwnerBankDetail $detail): bool
    {
        return $detail->shop_id === VendorContext::shopId()
            && ShopGate::allowsCurrent($user, 'vendor-finance-bank_details-edit');
    }
}
