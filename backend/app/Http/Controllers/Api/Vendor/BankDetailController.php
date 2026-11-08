<?php

namespace App\Http\Controllers\Api\Vendor;

use App\Http\Controllers\Controller;
use App\Http\Requests\Vendor\StoreBankDetailRequest;
use App\Models\OwnerBankDetail;
use App\Services\AuditService;
use App\Support\VendorContext;
use App\Traits\JsonResponse as JsonResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * The shop's bank accounts (where customers send bank transfers) — account_number is never returned (see
 * OwnerBankDetail::$hidden); only account_number_last4 reaches the
 * frontend. Restricted beyond the finance-bank_details permission to the
 * shop's own owner (rental_shops.owner_user_id), per the model's docblock.
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
        abort_unless(VendorContext::member()?->isShopOwner(), 403, 'Only the shop owner can manage bank details.');
    }

    /** {record, message, status} — ServerDataTable's expected shape, same as Api\LocationController::index(). */
    public function index(Request $request): JsonResponse
    {
        $details = OwnerBankDetail::where('shop_id', VendorContext::shopId())
            ->when($request->search, fn ($q) => $q->where(fn ($s) => $s
                ->where('bank_name', 'like', "%{$request->search}%")
                ->orWhere('account_holder_name', 'like', "%{$request->search}%")))
            ->orderByDesc('is_primary')
            ->paginate(min((int) $request->get('perPage', 20), 100));

        return response()->json([
            'record' => $details,
            'message' => 'Bank details retrieved successfully',
            'status' => true,
        ]);
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

    /** Bank-identity changes drop any platform verification - the new account hasn't been checked. */
    private const REVERIFY_FIELDS = ['account_holder_name', 'bank_name', 'bank_code', 'branch_name', 'branch_code', 'account_number'];

    public function update(StoreBankDetailRequest $request, OwnerBankDetail $bankDetail): JsonResponse
    {
        $this->assertOwner();
        abort_unless($bankDetail->shop_id === VendorContext::shopId(), 404);

        $data = $request->validated();
        if (empty($data['account_number'])) {
            unset($data['account_number']);
        } else {
            $data['account_number_last4'] = substr($data['account_number'], -4);
        }
        // The primary only moves when another account is made primary, so the shop is never left without one.
        if ($bankDetail->is_primary) {
            unset($data['is_primary']);
        }

        $old = $bankDetail->only(array_keys($data));
        $bankDetail->fill($data);
        if ($bankDetail->isDirty(self::REVERIFY_FIELDS)) {
            $bankDetail->fill(['verification_status' => 'unverified', 'verified_by' => null, 'verified_at' => null]);
        }

        DB::transaction(function () use ($bankDetail) {
            if ($bankDetail->is_primary && $bankDetail->isDirty('is_primary')) {
                OwnerBankDetail::where('shop_id', $bankDetail->shop_id)->whereKeyNot($bankDetail->id)->update(['is_primary' => false]);
            }
            $bankDetail->save();
        });

        unset($old['account_number'], $data['account_number']);
        AuditService::edit('OwnerBankDetail', $bankDetail->id, "{$bankDetail->bank_name} ••{$bankDetail->account_number_last4}", $old, $data);

        return $this->response('Bank detail updated', $bankDetail->fresh());
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
