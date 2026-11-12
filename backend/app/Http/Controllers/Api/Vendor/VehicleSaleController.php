<?php

namespace App\Http\Controllers\Api\Vendor;

use App\Actions\RecordVehicleSale;
use App\Http\Controllers\Controller;
use App\Http\Requests\Sale\RecordVehicleSaleRequest;
use App\Models\Vehicle;
use App\Models\VehicleSale;
use App\Services\AuditService;
use App\Services\AuthUser;
use App\Services\SaleAgreementService;
use App\Support\ShopGate;
use App\Support\VendorContext;
use App\Traits\JsonResponse as JsonResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Sold cars, recording a sale, the sale agreement and the shop's sale terms. */
class VehicleSaleController extends Controller
{
    use JsonResponseTrait;

    public function __construct(private SaleAgreementService $agreements)
    {
        $this->middleware('can:vendor-sales-sold-view')->only(['index', 'summary', 'show', 'agreement']);
        $this->middleware('can:vendor-sales-sold-create')->only('store');
        $this->middleware('can:vendor-sales-terms-edit')->only('updateTerms');
    }

    /** Filters: search, payment_method, date_from / date_to (sold on). Sorts: sold_at (default, newest first), sale_price, buyer_name. */
    public function index(Request $request): JsonResponse
    {
        $sortable = ['sold_at', 'sale_price', 'buyer_name'];
        $sort = in_array($request->sort_field, $sortable, true) ? $request->sort_field : 'sold_at';
        $dir = $request->sort_direction === 'asc' ? 'asc' : 'desc';

        $sales = VehicleSale::with('vehicle:id,title,make,model,year')
            ->when($request->search, fn ($q) => $q->where(fn ($s) => $s
                ->where('reference', 'like', "%{$request->search}%")
                ->orWhere('buyer_name', 'like', "%{$request->search}%")
                ->orWhereHas('vehicle', fn ($v) => $v->where('title', 'like', "%{$request->search}%"))))
            ->when($request->payment_method, fn ($q, $method) => $q->where('payment_method', $method))
            ->when($request->date_from, fn ($q, $from) => $q->whereDate('sold_at', '>=', $from))
            ->when($request->date_to, fn ($q, $to) => $q->whereDate('sold_at', '<=', $to))
            ->orderBy($sort, $dir)
            ->orderByDesc('id')
            ->paginate(min((int) $request->get('perPage', 20), 100));

        return response()->json(['record' => $sales, 'message' => 'Sales retrieved', 'status' => true]);
    }

    /** The tiles above the sold list: how many cars the shop has sold and for how much, all time and this month. */
    public function summary(): JsonResponse
    {
        $all = VehicleSale::query()
            ->selectRaw('COUNT(*) AS sold_count, COALESCE(SUM(sale_price), 0) AS sold_value, COALESCE(AVG(sale_price), 0) AS average_price')
            ->first();
        $month = VehicleSale::query()
            ->where('sold_at', '>=', now()->startOfMonth())
            ->selectRaw('COUNT(*) AS sold_count, COALESCE(SUM(sale_price), 0) AS sold_value')
            ->first();

        return $this->response('Sales summary retrieved', [
            'sold_count' => (int) $all->sold_count,
            'sold_value' => round((float) $all->sold_value, 2),
            'average_price' => round((float) $all->average_price, 2),
            'sold_this_month' => (int) $month->sold_count,
            'sold_value_this_month' => round((float) $month->sold_value, 2),
        ]);
    }

    /** One sale, with the buyer's NIC — so reading it is audited, like a shop's verification documents. */
    public function show(VehicleSale $sale): JsonResponse
    {
        AuditService::view('VehicleSale', $sale->id, $sale->reference);

        $sale->load(['vehicle.saleDetail', 'recordedBy:id,name', 'customer:id,name,email', 'enquiry:id,reference']);

        return $this->response('Sale retrieved', $sale->makeVisible('buyer_nic'));
    }

    public function store(RecordVehicleSaleRequest $request, Vehicle $vehicle, RecordVehicleSale $record): JsonResponse
    {
        abort_unless($vehicle->isForSale(), 404);

        return $this->response('Sale recorded', $record(AuthUser::user(), $vehicle, $request->validated()), 201);
    }

    public function agreement(Request $request, VehicleSale $sale): Response
    {
        $pdf = $this->agreements->pdf($sale);
        $filename = "{$sale->reference}.pdf";

        return $request->boolean('download') ? $pdf->download($filename) : $pdf->stream($filename);
    }

    /** Also read by the record-sale screen, so whoever records a sale can show the buyer what they're signing. */
    public function terms(): JsonResponse
    {
        $user = AuthUser::user();
        abort_unless(ShopGate::allowsCurrent($user, 'vendor-sales-terms-view') || ShopGate::allowsCurrent($user, 'vendor-sales-sold-create'), 403);

        return $this->response('Sale terms retrieved', ['terms' => (string) $this->agreements->termsFor(VendorContext::shopId())]);
    }

    public function updateTerms(Request $request): JsonResponse
    {
        $terms = $request->validate(['terms' => ['nullable', 'string', 'max:20000']])['terms'] ?? null;
        $saved = $this->agreements->saveTerms(VendorContext::shopId(), $terms);
        AuditService::edit('ShopSettings', VendorContext::shopId(), 'Sale terms', null, ['sale_terms' => 'updated']);

        return $this->response('Sale terms saved', ['terms' => $saved]);
    }
}
