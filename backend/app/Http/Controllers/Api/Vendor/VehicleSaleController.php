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
        $this->middleware('can:vendor-sales-sold-view')->only(['index', 'show', 'agreement']);
        $this->middleware('can:vendor-sales-sold-create')->only('store');
        $this->middleware('can:vendor-sales-terms-edit')->only('updateTerms');
    }

    public function index(Request $request): JsonResponse
    {
        $sales = VehicleSale::with('vehicle:id,title,year')
            ->when($request->search, fn ($q) => $q->where(fn ($s) => $s
                ->where('reference', 'like', "%{$request->search}%")
                ->orWhere('buyer_name', 'like', "%{$request->search}%")
                ->orWhereHas('vehicle', fn ($v) => $v->where('title', 'like', "%{$request->search}%"))))
            ->orderByDesc('sold_at')
            ->paginate(min((int) $request->get('perPage', 20), 100));

        return response()->json(['record' => $sales, 'message' => 'Sales retrieved', 'status' => true]);
    }

    /** One sale, with the buyer's NIC — so reading it is audited, like a shop's verification documents. */
    public function show(VehicleSale $sale): JsonResponse
    {
        AuditService::view('VehicleSale', $sale->id, $sale->reference);

        return $this->response('Sale retrieved', $sale->load(['vehicle', 'recordedBy:id,name'])->makeVisible('buyer_nic'));
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
