<?php

namespace App\Policies;

use App\Models\Administration\User;
use App\Models\OwnerBankDetail;
use App\Support\ShopAbility;
use App\Support\ShopGate;
use App\Support\VendorContext;

/**
 * bank_details.manage is deliberately granted to the `owner` role preset
 * only (see ShopAbility::presetFor - manager/staff never get it), so a
 * manager cannot read or change where payouts are sent even with
 * staff.manage. account_number itself is never serialized (see
 * OwnerBankDetail::$hidden) regardless of who passes this check.
 */
class OwnerBankDetailPolicy
{
    public function view(User $user, OwnerBankDetail $detail): bool
    {
        return $detail->shop_id === VendorContext::shopId()
            && ShopGate::allowsCurrent($user, ShopAbility::BankDetailsManage);
    }

    public function manage(User $user, OwnerBankDetail $detail): bool
    {
        return $this->view($user, $detail);
    }
}
