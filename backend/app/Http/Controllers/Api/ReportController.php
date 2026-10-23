<?php

namespace App\Http\Controllers\Api;

use App\Exports\ArrayExport;
use App\Http\Controllers\Controller;
use App\Models\Company;
use App\Services\ReportService;
use App\Support\Tenant;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Maatwebsite\Excel\Excel as ExcelFormat;
use Maatwebsite\Excel\Facades\Excel;
use Symfony\Component\HttpFoundation\Response;

class ReportController extends Controller
{
    private const LABELS = [
        'sales'                 => 'Sales Report',
        'outstanding_sales'     => 'Outstanding Receivables Report',
        'purchases'             => 'Purchase Report',
        'expenses'              => 'Expense Report',
        'outstanding_purchases' => 'Outstanding Payables Report',
        'item_sales'            => 'Item-wise Sales Report',
        'profit_margin'         => 'Profit / Margin Report',
        'daily_sales'           => 'Sales Summary Report',
        'customer_ledger'       => 'Customer Ledger Report',
        'expense_by_category'   => 'Expense by Category Report',
    ];

    public function __construct(private ReportService $service)
    {
    }

    public function index(Request $request, string $type): JsonResponse
    {
        $this->validateType($type);
        $this->authorizeType($request, $type);

        return response()->json([
            'message' => 'Report generated successfully',
            'data'    => $this->service->build($type, $request) + ['title' => self::LABELS[$type]],
        ]);
    }

    public function export(Request $request, string $type): Response
    {
        $request->validate(['format' => ['required', Rule::in(['csv', 'xlsx', 'pdf'])]]);
        $this->validateType($type);
        $this->authorizeType($request, $type);

        $report = $this->service->build($type, $request);
        $filename = $type . '-' . now()->format('Y-m-d');

        if ($request->format === 'pdf') {
            $pdf = Pdf::loadView('pdf.report', [
                'company' => Company::find(Tenant::id()),
                'title'   => self::LABELS[$type],
                'columns' => $report['columns'],
                'rows'    => $report['rows'],
            ])->setPaper('a4', count($report['columns']) > 7 ? 'landscape' : 'portrait');

            return $pdf->download("{$filename}.pdf");
        }

        $export = new ArrayExport($report['columns'], $report['rows']);
        $format = $request->format === 'csv' ? ExcelFormat::CSV : ExcelFormat::XLSX;

        return Excel::download($export, "{$filename}.{$request->format}", $format);
    }

    private function validateType(string $type): void
    {
        abort_unless(in_array($type, ReportService::types(), true), 404, "Unknown report type: {$type}");
    }

    /** Each report type is its own menu item/permission — see MenuSeeder's "reports" module. */
    private function authorizeType(Request $request, string $type): void
    {
        abort_unless($request->user()->can("reports-{$type}-view"), 403);
    }
}
