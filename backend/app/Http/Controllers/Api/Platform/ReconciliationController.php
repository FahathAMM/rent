<?php

namespace App\Http\Controllers\Api\Platform;

use App\Http\Controllers\Controller;
use App\Services\ReconciliationService;
use App\Traits\JsonResponse as JsonResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReconciliationController extends Controller
{
    use JsonResponseTrait;

    public function __construct(private ReconciliationService $service) {}

    public function index(Request $request): JsonResponse
    {
        return $this->response('Reconciliation summary retrieved', $this->service->summary($request->date_from, $request->date_to));
    }

    public function export(Request $request): StreamedResponse
    {
        $rows = $this->service->ledgerRows($request->date_from, $request->date_to);

        return response()->streamDownload(function () use ($rows) {
            $out = fopen('php://output', 'w');
            fputcsv($out, ['entry_date', 'batch_id', 'booking_reference', 'account', 'direction', 'amount', 'currency', 'memo']);
            foreach ($rows as $row) {
                fputcsv($out, [
                    $row->entry_date->toDateString(), $row->batch_id, $row->booking?->booking_reference,
                    $row->account, $row->direction, $row->amount, $row->currency, $row->memo,
                ]);
            }
            fclose($out);
        }, 'reconciliation-' . now()->format('Y-m-d') . '.csv');
    }
}
