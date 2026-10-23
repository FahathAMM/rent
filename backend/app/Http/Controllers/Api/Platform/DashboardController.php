<?php

namespace App\Http\Controllers\Api\Platform;

use App\Http\Controllers\Controller;
use App\Services\PlatformDashboardService;
use Illuminate\Http\JsonResponse;

class DashboardController extends Controller
{
    public function __construct(private PlatformDashboardService $dashboardService) {}

    public function index(): JsonResponse
    {
        return response()->json(['data' => $this->dashboardService->getSummary()]);
    }
}
