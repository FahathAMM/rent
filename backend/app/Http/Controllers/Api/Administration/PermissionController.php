<?php

namespace App\Http\Controllers\Api\Administration;

use App\Http\Controllers\Controller;
use App\Support\PermissionCatalogue;
use Illuminate\Http\JsonResponse;

/** Every permission grouped by page — the rows of the platform's Roles & Permissions grid. */
class PermissionController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(['data' => PermissionCatalogue::groups()]);
    }
}
