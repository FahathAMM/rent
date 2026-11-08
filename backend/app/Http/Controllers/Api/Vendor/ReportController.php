<?php

namespace App\Http\Controllers\Api\Vendor;

use App\Http\Controllers\Controller;
use App\Models\RentalShop;
use App\Services\AuthUser;
use App\Services\ShopReportService;
use App\Support\ShopGate;
use App\Support\VendorContext;
use App\Traits\JsonResponse as JsonResponseTrait;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Symfony\Component\HttpFoundation\Response;

/** The shop's reports. Each one has its own vendor-reports-{report}-view permission, since they show money. */
class ReportController extends Controller
{
    use JsonResponseTrait;

    public function __construct(private ShopReportService $reports) {}

    public function show(Request $request, string $report): JsonResponse
    {
        [$from, $to] = $this->period($request, $report);

        return $this->response('Report retrieved', $this->reports->build($report, $from, $to) + [
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
            'dated' => !in_array($report, ShopReportService::UNDATED, true),
        ]);
    }

    public function export(Request $request, string $report): Response
    {
        [$from, $to] = $this->period($request, $report);
        $data = $this->reports->build($report, $from, $to);
        $filename = "{$report}-{$from->toDateString()}-to-{$to->toDateString()}";

        if ($request->input('format') === 'pdf') {
            return Pdf::loadView('pdf.shop-report', $data + [
                'shop' => RentalShop::find(VendorContext::shopId()),
                'from' => $from,
                'to' => $to,
                'dated' => !in_array($report, ShopReportService::UNDATED, true),
                'cell' => fn (array $column, $value) => $this->display($column['type'], $value),
            ])->setPaper('a4', 'landscape')->download("{$filename}.pdf");
        }

        return response()->streamDownload(function () use ($data) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF"); // so Excel reads the file as UTF-8
            fputcsv($out, array_column($data['columns'], 'label'));
            foreach ($data['rows'] as $row) {
                fputcsv($out, array_map(fn (array $column) => $this->csvCell($row[$column['key']] ?? ''), $data['columns']));
            }
            fclose($out);
        }, "{$filename}.csv", ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    /** @return array{0: Carbon, 1: Carbon} Defaults to this year so far. */
    private function period(Request $request, string $report): array
    {
        abort_unless(in_array($report, ShopReportService::REPORTS, true), 404);
        abort_unless(ShopGate::allowsCurrent(AuthUser::user(), "vendor-reports-{$report}-view"), 403);

        $data = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'format' => ['nullable', 'in:pdf,csv'],
        ]);
        $timezone = config('app.timezone');

        return [
            !empty($data['from']) ? Carbon::parse($data['from'], $timezone)->startOfDay() : now()->startOfYear(),
            !empty($data['to']) ? Carbon::parse($data['to'], $timezone)->endOfDay() : now()->endOfDay(),
        ];
    }

    private function display(string $type, $value): string
    {
        return match ($type) {
            'money' => number_format((float) $value, 2),
            'percent' => "{$value}%",
            'status' => ucwords(str_replace('_', ' ', (string) $value)),
            default => (string) ($value ?? '—'),
        };
    }

    /** Names come from customers: a leading = + - @ would run as a formula when the file is opened in Excel. */
    private function csvCell($value)
    {
        return is_string($value) && preg_match('/^[=+\-@\t\r]/', $value) ? "'{$value}" : $value;
    }
}
