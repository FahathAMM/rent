<?php

namespace App\Repositories;

use App\Http\Requests\Sale\StoreSaleRequest;
use App\Http\Requests\Sale\UpdateSaleRequest;
use App\Models\Sale;
use App\Services\AuthUser;
use App\Support\DocumentTotals;
use App\Support\NumberGenerator;
use App\Support\Tenant;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SaleRepo extends BaseRepository
{
    protected $model;

    public function __construct(Sale $model)
    {
        $this->model = $model;
    }

    public function getData(Request $request): LengthAwarePaginator
    {
        $sortable = ['sale_number', 'sale_date', 'total', 'balance_amount', 'status', 'created_at'];
        $sort = in_array($request->sort_field, $sortable) ? $request->sort_field : 'sale_date';
        $dir  = $request->sort_direction === 'desc' ? 'desc' : 'asc';

        return $this->model
            ->with('customer')
            ->withCount('items')
            ->when($request->search, fn ($q) =>
                $q->where('sale_number', 'like', "%{$request->search}%")
                  ->orWhere('reference_no', 'like', "%{$request->search}%")
                  ->orWhere('walk_in_name', 'like', "%{$request->search}%")
                  ->orWhereHas('customer', fn ($cq) => $cq->where('name', 'like', "%{$request->search}%")))
            ->when($request->customer_id, fn ($q) => $q->where('customer_id', $request->customer_id))
            ->when($request->status, fn ($q) => $q->where('status', $request->status))
            ->orderBy($sort, $dir)
            ->paginate(min($request->perPage ?? 50, 100));
    }

    public function store(StoreSaleRequest $request): Sale
    {
        $data = $request->validated();
        $lines = $data['items'];
        unset($data['items']);

        [$lineRows, $header] = $this->computeTotals($lines, $data['discount_type'] ?? null, (float) ($data['discount_value'] ?? 0));
        $paidAmount = (float) ($data['paid_amount'] ?? 0);

        return DB::transaction(function () use ($data, $lineRows, $header, $paidAmount) {
            $sale = $this->model->create($data + $header + [
                'sale_number'    => NumberGenerator::next(Tenant::id(), 'invoice'),
                'paid_amount'    => $paidAmount,
                'balance_amount' => round($header['total'] - $paidAmount, 2),
                'status'         => $data['status'] ?? 'completed',
                'created_by'     => AuthUser::id(),
            ]);

            $this->createItems($sale, $lineRows);

            return $sale->fresh(['items', 'customer']);
        });
    }

    public function update(Sale $sale, UpdateSaleRequest $request): Sale
    {
        if ($sale->hasPayments()) {
            throw new \RuntimeException('Cannot edit a sale that already has a payment recorded against it.');
        }

        $data = $request->validated();
        $lines = $data['items'];
        unset($data['items']);

        [$lineRows, $header] = $this->computeTotals($lines, $data['discount_type'] ?? null, (float) ($data['discount_value'] ?? 0));
        $paidAmount = (float) ($data['paid_amount'] ?? 0);

        return DB::transaction(function () use ($sale, $data, $lineRows, $header, $paidAmount) {
            $sale->update($data + $header + [
                'paid_amount'    => $paidAmount,
                'balance_amount' => round($header['total'] - $paidAmount, 2),
                'status'         => $data['status'] ?? $sale->status,
            ]);

            $sale->items()->delete();
            $this->createItems($sale, $lineRows);

            return $sale->fresh(['items', 'customer']);
        });
    }

    public function destroy(Sale $sale): void
    {
        if ($sale->hasPayments()) {
            throw new \RuntimeException('Cannot delete a sale that already has a payment recorded against it — cancel it instead.');
        }

        $sale->delete();
    }

    /** Records a payment against the sale and bumps paid_amount/balance_amount to match. */
    public function recordPayment(Sale $sale, array $data): Sale
    {
        return DB::transaction(function () use ($sale, $data) {
            $sale->payments()->create([
                'amount'         => $data['amount'],
                'payment_date'   => $data['payment_date'],
                'payment_method' => $data['payment_method'] ?? null,
                'reference_no'   => $data['reference_no'] ?? null,
                'notes'          => $data['notes'] ?? null,
                'created_by'     => AuthUser::id(),
            ]);

            $paid = round((float) $sale->paid_amount + (float) $data['amount'], 2);
            $paid = min($paid, (float) $sale->total);

            $sale->update([
                'paid_amount'    => $paid,
                'balance_amount' => round((float) $sale->total - $paid, 2),
            ]);

            return $sale->fresh(['payments', 'items', 'customer']);
        });
    }

    private function createItems(Sale $sale, array $lineRows): void
    {
        foreach ($lineRows as $sortOrder => $line) {
            $sale->items()->create([
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
