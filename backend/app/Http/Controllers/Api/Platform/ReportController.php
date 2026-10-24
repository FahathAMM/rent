<?php

namespace App\Http\Controllers\Api\Platform;

use App\Http\Controllers\Controller;
use App\Http\Requests\Platform\ActionReportRequest;
use App\Models\Report;
use App\Models\SystemAdmin;
use App\Services\ReportService;
use App\Traits\JsonResponse as JsonResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReportController extends Controller
{
    use JsonResponseTrait;

    public function __construct(private ReportService $service) {}

    public function index(Request $request): JsonResponse
    {
        $reports = Report::with(['reportedBy:id,name,email', 'reviewedBy:id,name'])
            ->when($request->status, fn ($q) => $q->where('status', $request->status), fn ($q) => $q->where('status', Report::STATUS_NEW))
            ->when($request->reason, fn ($q) => $q->where('reason', $request->reason))
            ->orderByDesc('created_at')
            ->paginate(min((int) $request->get('perPage', 20), 100));

        return response()->json(['record' => $reports, 'message' => 'Reports retrieved', 'status' => true]);
    }

    public function action(ActionReportRequest $request, Report $report): JsonResponse
    {
        $admin = $this->admin();

        $report = $this->service->action(
            $admin,
            $report,
            $request->validated('status'),
            $request->validated('action_taken'),
            $request->validated('internal_note'),
        );

        return $this->response('Report updated', $report);
    }

    private function admin(): SystemAdmin
    {
        /** @var SystemAdmin $admin */
        $admin = auth('platform')->user();

        return $admin;
    }
}
