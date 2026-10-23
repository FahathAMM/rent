<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Sale\StoreSaleRequest;
use App\Http\Requests\Sale\UpdateSaleRequest;
use App\Models\Sale;
use App\Repositories\SaleRepo;
use App\Services\AuditService;
use App\Traits\JsonResponse as JsonResponseTrait;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Storage;

class SaleController extends Controller
{
    use JsonResponseTrait;

    private const STATUS_COLORS = [
        'completed' => '#059669', 'cancelled' => '#dc2626',
    ];

    public function __construct(private SaleRepo $repo)
    {
        $this->middleware('can:sales-orders-view')->only(['index', 'show', 'pdf']);
        $this->middleware('can:sales-orders-create')->only('store');
        $this->middleware('can:sales-orders-edit')->only(['update', 'recordPayment']);
        $this->middleware('can:sales-orders-delete')->only('destroy');
    }

    public function index(Request $request): JsonResponse
    {
        return response()->json([
            'record'  => $this->repo->getData($request),
            'message' => 'Sales retrieved successfully',
            'status'  => true,
        ]);
    }

    public function store(StoreSaleRequest $request): JsonResponse
    {
        $sale = $this->repo->store($request);

        AuditService::create('Sale', $sale->id, $sale->sale_number);

        return $this->response('Sale created successfully', $sale, 201);
    }

    public function show(Sale $sale): JsonResponse
    {
        return $this->response('Sale retrieved successfully', $sale->load([
            'items.item', 'customer', 'createdBy',
            'payments' => fn ($q) => $q->latest('payment_date')->latest('id'),
            'payments.createdBy',
        ]));
    }

    public function update(UpdateSaleRequest $request, Sale $sale): JsonResponse
    {
        try {
            $old = $sale->only($sale->getFillable());

            $sale = $this->repo->update($sale, $request);

            AuditService::edit('Sale', $sale->id, $sale->sale_number, $old, $sale->only($sale->getFillable()));

            return $this->response('Sale updated successfully', $sale);
        } catch (\RuntimeException $e) {
            return $this->response($e->getMessage(), null, 422);
        }
    }

    public function destroy(Sale $sale): JsonResponse
    {
        try {
            $number = $sale->sale_number;
            $this->repo->destroy($sale);

            AuditService::delete('Sale', $sale->id, $number);

            return $this->response('Sale deleted successfully');
        } catch (\RuntimeException $e) {
            return $this->response($e->getMessage(), null, 422);
        }
    }

    /** Records a payment towards this sale — bumps paid_amount and logs the payment itself. */
    public function recordPayment(Request $request, Sale $sale): JsonResponse
    {
        $data = $request->validate([
            'amount'         => 'required|numeric|min:0.01|max:' . max((float) $sale->balance_amount, 0.01),
            'payment_date'   => 'required|date',
            'payment_method' => 'nullable|string|max:50',
            'reference_no'   => 'nullable|string|max:255',
            'notes'          => 'nullable|string',
        ]);

        $sale = $this->repo->recordPayment($sale, $data);

        AuditService::edit('Sale', $sale->id, $sale->sale_number);

        return $this->response('Payment recorded successfully', $sale);
    }

    public function pdf(Sale $sale): Response
    {
        $sale->load(['items.item', 'customer', 'company', 'company.settings']);

        return Pdf::loadView('pdf.sale', $this->pdfData($sale))
            ->setPaper('a4')
            ->download("{$sale->sale_number}.pdf");
    }

    private function pdfData(Sale $sale): array
    {
        $company = clone $sale->company;

        if ($company->logo && Storage::disk('public')->exists($company->logo)) {
            $mime = Storage::disk('public')->mimeType($company->logo);
            $company->logo = 'data:' . $mime . ';base64,' . base64_encode(Storage::disk('public')->get($company->logo));
        } else {
            $company->logo = null;
        }

        return [
            'company'            => $company,
            'customer'           => $sale->customer,
            'customerName'       => $sale->customer_name,
            'document'           => $sale,
            'items'              => $sale->items,
            'docTitle'           => 'Invoice',
            'docNumber'          => $sale->sale_number,
            'docDate'            => $sale->sale_date->format('d M Y'),
            'secondaryDateLabel' => $sale->due_date ? 'Due Date' : null,
            'secondaryDate'      => $sale->due_date?->format('d M Y'),
            'statusLabel'        => $sale->balance_amount <= 0 ? 'Paid' : ($sale->paid_amount > 0 ? 'Partially Paid' : ucfirst($sale->status)),
            'statusColor'        => $sale->balance_amount <= 0 ? '#059669' : (self::STATUS_COLORS[$sale->status] ?? '#d97706'),
            'currency'           => $company->currency,
            'invoiceFooter'      => $company->settings?->invoice_footer,
        ];
    }
}
