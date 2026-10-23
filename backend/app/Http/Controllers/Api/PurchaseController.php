<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Purchase\StorePurchaseRequest;
use App\Http\Requests\Purchase\UpdatePurchaseRequest;
use App\Models\Purchase;
use App\Repositories\PurchaseRepo;
use App\Services\AuditService;
use App\Traits\JsonResponse as JsonResponseTrait;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Storage;

class PurchaseController extends Controller
{
    use JsonResponseTrait;

    private const STATUS_COLORS = [
        'pending' => '#d97706', 'received' => '#059669', 'cancelled' => '#dc2626',
    ];

    public function __construct(private PurchaseRepo $repo)
    {
        $this->middleware('can:purchasing-purchases-view')->only(['index', 'show', 'pdf']);
        $this->middleware('can:purchasing-purchases-create')->only('store');
        $this->middleware('can:purchasing-purchases-edit')->only(['update', 'recordPayment']);
        $this->middleware('can:purchasing-purchases-delete')->only('destroy');
    }

    public function index(Request $request): JsonResponse
    {
        return response()->json([
            'record'  => $this->repo->getData($request),
            'message' => 'Purchases retrieved successfully',
            'status'  => true,
        ]);
    }

    public function store(StorePurchaseRequest $request): JsonResponse
    {
        $purchase = $this->repo->store($request);

        AuditService::create('Purchase', $purchase->id, $purchase->purchase_number);

        return $this->response('Purchase created successfully', $purchase, 201);
    }

    public function show(Purchase $purchase): JsonResponse
    {
        return $this->response('Purchase retrieved successfully', $purchase->load([
            'items.item', 'vendor', 'createdBy',
            'payments' => fn ($q) => $q->latest('payment_date')->latest('id'),
            'payments.createdBy',
        ]));
    }

    public function update(UpdatePurchaseRequest $request, Purchase $purchase): JsonResponse
    {
        try {
            $old = $purchase->only($purchase->getFillable());

            $purchase = $this->repo->update($purchase, $request);

            AuditService::edit('Purchase', $purchase->id, $purchase->purchase_number, $old, $purchase->only($purchase->getFillable()));

            return $this->response('Purchase updated successfully', $purchase);
        } catch (\RuntimeException $e) {
            return $this->response($e->getMessage(), null, 422);
        }
    }

    public function destroy(Purchase $purchase): JsonResponse
    {
        try {
            $number = $purchase->purchase_number;
            $this->repo->destroy($purchase);

            AuditService::delete('Purchase', $purchase->id, $number);

            return $this->response('Purchase deleted successfully');
        } catch (\RuntimeException $e) {
            return $this->response($e->getMessage(), null, 422);
        }
    }

    /** Records a payment towards this purchase — bumps paid_amount and logs the payment itself. */
    public function recordPayment(Request $request, Purchase $purchase): JsonResponse
    {
        $data = $request->validate([
            'amount'         => 'required|numeric|min:0.01|max:' . max((float) $purchase->balance_amount, 0.01),
            'payment_date'   => 'required|date',
            'payment_method' => 'nullable|string|max:50',
            'reference_no'   => 'nullable|string|max:255',
            'notes'          => 'nullable|string',
        ]);

        $purchase = $this->repo->recordPayment($purchase, $data);

        AuditService::edit('Purchase', $purchase->id, $purchase->purchase_number);

        return $this->response('Payment recorded successfully', $purchase);
    }

    public function pdf(Purchase $purchase): Response
    {
        $purchase->load(['items.item', 'vendor', 'company']);

        return Pdf::loadView('pdf.purchase', $this->pdfData($purchase))
            ->setPaper('a4')
            ->download("{$purchase->purchase_number}.pdf");
    }

    private function pdfData(Purchase $purchase): array
    {
        $company = clone $purchase->company;

        if ($company->logo && Storage::disk('public')->exists($company->logo)) {
            $mime = Storage::disk('public')->mimeType($company->logo);
            $company->logo = 'data:' . $mime . ';base64,' . base64_encode(Storage::disk('public')->get($company->logo));
        } else {
            $company->logo = null;
        }

        return [
            'company'            => $company,
            'vendor'             => $purchase->vendor,
            'document'           => $purchase,
            'items'              => $purchase->items,
            'docTitle'           => 'Purchase',
            'docNumber'          => $purchase->purchase_number,
            'docDate'            => $purchase->purchase_date->format('d M Y'),
            'secondaryDateLabel' => $purchase->due_date ? 'Due Date' : null,
            'secondaryDate'      => $purchase->due_date?->format('d M Y'),
            'status'             => $purchase->status,
            'statusColor'        => self::STATUS_COLORS[$purchase->status] ?? '#6b7280',
            'currency'           => $company->currency,
        ];
    }
}
