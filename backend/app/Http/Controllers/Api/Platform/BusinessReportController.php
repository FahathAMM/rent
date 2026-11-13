<?php

namespace App\Http\Controllers\Api\Platform;

use App\Http\Controllers\Controller;
use App\Models\PlatformDetail;
use App\Models\SystemAdmin;
use App\Services\PlatformReportService;
use App\Traits\JsonResponse as JsonResponseTrait;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Symfony\Component\HttpFoundation\Response;

/**
 * The platform's reports — /platform/reports. (ReportController in this folder is abuse
 * reports, a different thing.) Any platform admin can open the shop, marketplace, trust
 * and system reports; the money reports are Platform Owner only, like /platform/accounts.
 */
class BusinessReportController extends Controller
{
    use JsonResponseTrait;

    public function __construct(private PlatformReportService $reports) {}

    /** The catalogue: the reports this admin may open, grouped. */
    public function index(): JsonResponse
    {
        $isOwner = $this->admin()->isOwner();

        $groups = collect(PlatformReportService::GROUPS)->map(fn (string $label, string $group) => [
            'key' => $group,
            'label' => $label,
            'reports' => collect(PlatformReportService::REPORTS)
                ->filter(fn (array $r) => $r['group'] === $group && ($isOwner || !$r['owner_only']))
                ->map(fn (array $r, string $slug) => ['slug' => $slug, 'title' => $r['title'], 'description' => $r['description'], 'owner_only' => $r['owner_only'], 'dated' => $r['dated']])
                ->values(),
        ])->filter(fn (array $g) => $g['reports']->isNotEmpty())->values();

        return $this->response('Reports retrieved', $groups);
    }

    public function show(Request $request, string $report): JsonResponse
    {
        [$from, $to] = $this->period($request, $report);

        return $this->response('Report retrieved', $this->reports->build($report, $from, $to) + [
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
            'dated' => PlatformReportService::REPORTS[$report]['dated'],
        ]);
    }

    public function export(Request $request, string $report): Response
    {
        [$from, $to] = $this->period($request, $report);
        $data = $this->reports->build($report, $from, $to);
        $dated = PlatformReportService::REPORTS[$report]['dated'];
        $filename = $dated ? "{$report}-{$from->toDateString()}-to-{$to->toDateString()}" : "{$report}-" . now()->toDateString();

        if ($request->input('format') === 'pdf') {
            // The vendor report layout, headed with the platform's name instead of a shop's.
            return Pdf::loadView('pdf.shop-report', $data + [
                'shop' => (object) ['name' => PlatformDetail::query()->value('name') ?: config('app.name')],
                'from' => $from,
                'to' => $to,
                'dated' => $dated,
                'cell' => fn (array $column, $value) => $this->display($column['type'], $value),
            ])->setPaper('a4', 'landscape')->download("{$filename}.pdf");
        }

        $out = fopen('php://temp', 'w+');
        fwrite($out, "\xEF\xBB\xBF"); // so Excel reads the file as UTF-8
        fputcsv($out, array_column($data['columns'], 'label'));
        foreach ($data['rows'] as $row) {
            fputcsv($out, array_map(fn (array $column) => $this->csvCell($row[$column['key']] ?? ''), $data['columns']));
        }
        rewind($out);
        $csv = stream_get_contents($out);
        fclose($out);

        return response($csv, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => "attachment; filename=\"{$filename}.csv\"",
        ]);
    }

    private function admin(): SystemAdmin
    {
        return auth('platform')->user();
    }

    /** @return array{0: Carbon, 1: Carbon} Defaults to this year so far. Also the access check. */
    private function period(Request $request, string $report): array
    {
        abort_unless(isset(PlatformReportService::REPORTS[$report]), 404);
        abort_if(PlatformReportService::REPORTS[$report]['owner_only'] && !$this->admin()->isOwner(), 403, 'Only the Platform Owner can open this report.');

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

    /** Names come from shops and customers: a leading = + - @ would run as a formula when the file is opened in Excel. */
    private function csvCell($value)
    {
        return is_string($value) && preg_match('/^[=+\-@\t\r]/', $value) ? "'{$value}" : $value;
    }
}
