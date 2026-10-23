<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ItemDailyPrice;
use App\Services\AuditService;
use App\Support\Tenant;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ItemDailyPriceController extends Controller
{
    public function __construct()
    {
        $this->middleware('can:product-item-view')->only('index');
        $this->middleware('can:product-item-edit')->only('store');
    }

    /** Price history for reporting — filterable by item and date range. */
    public function index(Request $request): JsonResponse
    {
        $sortable = ['price_date', 'created_at'];
        $sort = in_array($request->sort_field, $sortable, true) ? $request->sort_field : 'price_date';
        $dir  = $request->sort_direction === 'asc' ? 'asc' : 'desc';

        $query = ItemDailyPrice::query()
            ->with(['item' => fn ($q) => $q->select('id', 'name', 'category', 'unit_id')->with('unit:id,name,short_name')])
            ->when($request->item_id, fn ($q) => $q->where('item_id', $request->item_id))
            ->when($request->from, fn ($q) => $q->whereDate('price_date', '>=', $request->from))
            ->when($request->to, fn ($q) => $q->whereDate('price_date', '<=', $request->to))
            ->when($request->search, fn ($q) => $q->whereHas('item', fn ($iq) => $iq->where('name', 'like', "%{$request->search}%")))
            ->orderBy($sort, $dir);

        return response()->json([
            'record'  => $query->paginate(min($request->perPage ?? 30, 100)),
            'message' => 'Daily price history retrieved successfully',
            'status'  => true,
        ]);
    }

    /**
     * Bulk-sets today's purchase/selling price override per item. A row with
     * both prices left empty clears today's override instead (falls back to
     * the item's base price) rather than being silently skipped.
     */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'prices'                  => 'required|array|min:1',
            'prices.*.item_id'        => [
                'required', 'integer',
                Rule::exists('items', 'id')->where(fn ($q) => $q->where('company_id', Tenant::id())),
            ],
            'prices.*.purchase_price' => 'nullable|numeric|min:0',
            'prices.*.selling_price'  => 'nullable|numeric|min:0',
        ]);

        $today = now()->toDateString();
        $count = 0;

        foreach ($data['prices'] as $row) {
            $purchase = $row['purchase_price'] ?? null;
            $selling  = $row['selling_price'] ?? null;

            if ($purchase === null && $selling === null) {
                ItemDailyPrice::where('item_id', $row['item_id'])->whereDate('price_date', $today)->delete();

                continue;
            }

            ItemDailyPrice::updateOrCreate(
                ['item_id' => $row['item_id'], 'price_date' => $today],
                ['purchase_price' => $purchase, 'selling_price' => $selling]
            );
            $count++;
        }

        AuditService::create('ItemDailyPrice', null, "Daily prices for {$today}", ['price_date' => $today, 'items_updated' => $count]);

        return response()->json([
            'message' => "Updated today's price for {$count} product" . ($count === 1 ? '' : 's'),
            'status'  => true,
        ]);
    }
}
