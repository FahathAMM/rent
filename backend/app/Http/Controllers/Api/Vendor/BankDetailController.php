<?php

namespace App\Http\Controllers\Api\Vendor;

use App\Http\Controllers\Controller;
use App\Http\Requests\Vendor\StoreBankDetailRequest;
use App\Models\OwnerBankDetail;
use App\Models\ShopMember;
use App\Services\AuditService;
use App\Support\VendorContext;
use App\Traits\JsonResponse as JsonResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

/**
 * Payout destination management — account_number is never returned (see
 * OwnerBankDetail::$hidden); only account_number_last4 reaches the
 * frontend. Restricted beyond the finance-bank_details permission to the
 * shop's own `owner` ShopMember role, per the model's docblock.
 */
class BankDetailController extends Controller
{
    use JsonResponseTrait;

    public function __construct()
    {
        $this->middleware('can:vendor-finance-bank_details-view')->only('index');
        $this->middleware('can:vendor-finance-bank_details-edit')->only(['store', 'update', 'destroy', 'makePrimary']);
    }

    private function assertOwner(): void
    {
        abort_unless(VendorContext::membership()?->role === ShopMember::ROLE_OWNER, 403, 'Only the shop owner can manage bank details.');
    }

    public function index(): JsonResponse
    {
        $details = OwnerBankDetail::where('shop_id', VendorContext::shopId())
            ->orderByDesc('is_primary')
            ->get();

        return $this->response('Bank details retrieved', $details);
    }

    public function store(StoreBankDetailRequest $request): JsonResponse
    {
        $this->assertOwner();

        $data = $request->validated();
        $data['account_number_last4'] = substr($data['account_number'], -4);
        $data['shop_id'] = VendorContext::shopId();

        $detail = DB::transaction(function () use ($data) {
            if (!empty($data['is_primary'])) {
                OwnerBankDetail::where('shop_id', $data['shop_id'])->update(['is_primary' => false]);
            }

            return OwnerBankDetail::create($data);
        });

        AuditService::create('OwnerBankDetail', $detail->id, "{$detail->bank_name} ••{$detail->account_number_last4}");

        return $this->response('Bank detail added', $detail->fresh(), 201);
    }

    public function makePrimary(OwnerBankDetail $bankDetail): JsonResponse
    {
        $this->assertOwner();
        abort_unless($bankDetail->shop_id === VendorContext::shopId(), 404);

        DB::transaction(function () use ($bankDetail) {
            OwnerBankDetail::where('shop_id', $bankDetail->shop_id)->update(['is_primary' => false]);
            $bankDetail->update(['is_primary' => true]);
        });

        AuditService::edit('OwnerBankDetail', $bankDetail->id, $bankDetail->bank_name, [], ['is_primary' => true]);

        return $this->response('Primary bank detail updated', $bankDetail->fresh());
    }

    public function destroy(OwnerBankDetail $bankDetail): JsonResponse
    {
        $this->assertOwner();
        abort_unless($bankDetail->shop_id === VendorContext::shopId(), 404);

        $label = "{$bankDetail->bank_name} ••{$bankDetail->account_number_last4}";
        $bankDetail->delete();

        AuditService::delete('OwnerBankDetail', $bankDetail->id, $label);

        return $this->response('Bank detail deleted');
    }
}
