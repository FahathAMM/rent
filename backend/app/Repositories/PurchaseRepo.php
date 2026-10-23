<?php

namespace App\Repositories;

use App\Http\Requests\Purchase\StorePurchaseRequest;
use App\Http\Requests\Purchase\UpdatePurchaseRequest;
use App\Models\Purchase;
use App\Services\AuthUser;
use App\Support\DocumentTotals;
use App\Support\NumberGenerator;
use App\Support\Tenant;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PurchaseRepo extends BaseRepository
{
    protected $model;

    public function __construct(Purchase $model)
    {
        $this->model = $model;
    }

    public function getData(Request $request): LengthAwarePaginator
    {
        $sortable = ['purchase_number', 'purchase_date', 'total', 'balance_amount', 'status', 'created_at'];
        $sort = in_array($request->sort_field, $sortable) ? $request->sort_field : 'purchase_date';
        $dir  = $request->sort_direction === 'desc' ? 'desc' : 'asc';

        return $this->model
            ->with('vendor')
            ->withCount('items')
            ->when($request->search, fn ($q) =>
                $q->where('purchase_number', 'like', "%{$request->search}%")
                  ->orWhere('reference_no', 'like', "%{$request->search}%")
                  ->orWhereHas('vendor', fn ($vq) => $vq->where('name', 'like', "%{$request->search}%")))
            ->when($request->vendor_id, fn ($q) => $q->where('vendor_id', $request->vendor_id))
            ->when($request->status, fn ($q) => $q->where('status', $request->status))
            ->orderBy($sort, $dir)
            ->paginate(min($request->perPage ?? 50, 100));
    }

    public function store(StorePurchaseRequest $request): Purchase
    {
        $data = $request->validated();
        $lines = $data['items'];
        unset($data['items']);

        [$lineRows, $header] = $this->computeTotals($lines, $data['discount_type'] ?? null, (float) ($data['discount_value'] ?? 0));
        $paidAmount = (float) ($data['paid_amount'] ?? 0);

        return DB::transaction(function () use ($data, $lineRows, $header, $paidAmount) {
            $purchase = $this->model->create($data + $header + [
                'purchase_number' => NumberGenerator::next(Tenant::id(), 'purchase'),
                'paid_amount'     => $paidAmount,
                'balance_amount'  => round($header['total'] - $paidAmount, 2),
                'status'          => $data['status'] ?? 'received',
                'created_by'      => AuthUser::id(),
            ]);

            $this->createItems($purchase, $lineRows);

            return $purchase->fresh(['items', 'vendor']);
        });
    }

    public function update(Purchase $purchase, UpdatePurchaseRequest $request): Purchase
    {
        if ($purchase->hasPayments()) {
            throw new \RuntimeException('Cannot edit a purchase that already has a payment recorded against it.');
        }

        $data = $request->validated();
        $lines = $data['items'];
        unset($data['items']);

        [$lineRows, $header] = $this->computeTotals($lines, $data['discount_type'] ?? null, (float) ($data['discount_value'] ?? 0));
        $paidAmount = (float) ($data['paid_amount'] ?? 0);

        return DB::transaction(function () use ($purchase, $data, $lineRows, $header, $paidAmount) {
            $purchase->update($data + $header + [
                'paid_amount'    => $paidAmount,
                'balance_amount' => round($header['total'] - $paidAmount, 2),
                'status'         => $data['status'] ?? $purchase->status,
            ]);

            $purchase->items()->delete();
            $this->createItems($purchase, $lineRows);

            return $purchase->fresh(['items', 'vendor']);
        });
    }

    public function destroy(Purchase $purchase): void
    {
        if ($purchase->hasPayments()) {
            throw new \RuntimeException('Cannot delete a purchase that already has a payment recorded against it — cancel it instead.');
        }

        $purchase->delete();
    }

    /** Records a payment against the purchase and bumps paid_amount/balance_amount to match. */
    public function recordPayment(Purchase $purchase, array $data): Purchase
    {
        return DB::transaction(function () use ($purchase, $data) {
            $purchase->payments()->create([
                'amount'         => $data['amount'],
                'payment_date'   => $data['payment_date'],
                'payment_method' => $data['payment_method'] ?? null,
                'reference_no'   => $data['reference_no'] ?? null,
                'notes'          => $data['notes'] ?? null,
                'created_by'     => AuthUser::id(),
            ]);

            $paid = round((float) $purchase->paid_amount + (float) $data['amount'], 2);
            $paid = min($paid, (float) $purchase->total);

            $purchase->update([
                'paid_amount'    => $paid,
                'balance_amount' => round((float) $purchase->total - $paid, 2),
            ]);

            return $purchase->fresh(['payments', 'items', 'vendor']);
        });
    }

    private function createItems(Purchase $purchase, array $lineRows): void
    {
        foreach ($lineRows as $sortOrder => $line) {
            $purchase->items()->create([
                'item_id'         => $line['item_id'] ?? null,
                'description'     => $line['description'],
                'quantity'        => $line['quantity'],
                'unit_price'      => $line['unit_price'],
                'discount_type'   => $line['discount_type'] ?? null,
                'discount_value'  => $line['discount_value'] ?? 0,
                'discount_amount' => $line['discount_amount'],
                'tax_rate'        => $line['tax_rate'] ?? 0,
                'tax_amount'      => $line['tax_amount'],
                'subtotal'        => $line['subtotal'],
                'total'           => $line['total'],
                'sort_order'      => $sortOrder,
            ]);
        }
    }

    /** @return array{0: array, 1: array} [lineRows-with-computed-totals, header totals] */
    private function computeTotals(array $lines, ?string $discountType, float $discountValue): array
    {
        $lineRows = [];
        foreach ($lines as $line) {
            $totals = DocumentTotals::line(
                (float) $line['quantity'],
                (float) $line['unit_price'],
                $line['discount_type'] ?? null,
                (float) ($line['discount_value'] ?? 0),
                (float) ($line['tax_rate'] ?? 0)
            );
            $lineRows[] = array_merge($line, $totals);
        }

        $header = DocumentTotals::header($lineRows, $discountType, $discountValue);

        return [$lineRows, [
            'subtotal'         => $header['subtotal'],
            'discount_type'    => $discountType,
            'discount_value'   => $discountValue,
            'discount_amount'  => $header['discount_amount'],
            'tax_amount'       => $header['tax_amount'],
            'total'            => $header['total'],
        ]];
    }
}
