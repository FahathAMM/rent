<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Report\StoreReportRequest;
use App\Services\AuditService;
use App\Services\AuthUser;
use App\Services\ReportService;
use App\Traits\JsonResponse as JsonResponseTrait;
use Illuminate\Http\JsonResponse;

class ReportController extends Controller
{
    use JsonResponseTrait;

    public function __construct(private ReportService $service) {}

    public function store(StoreReportRequest $request): JsonResponse
    {
        $report = $this->service->create(
            AuthUser::user(),
            null,
            $request->validated('reportable_type'),
            $request->validated('reportable_id'),
            $request->validated('reason'),
            $request->validated('description'),
        );

        AuditService::create('Report', $report->id, "Report on {$request->validated('reportable_type')} #{$request->validated('reportable_id')}");

        return $this->response('Report submitted — our team will review it', $report, 201);
    }
}
