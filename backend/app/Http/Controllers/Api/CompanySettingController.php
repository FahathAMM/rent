<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Company\UpdateCompanySettingRequest;
use App\Http\Resources\CompanySettingResource;
use App\Models\CompanySetting;
use App\Services\AuditService;
use App\Support\Tenant;
use Illuminate\Http\JsonResponse;

class CompanySettingController extends Controller
{
    public function __construct()
    {
        $this->middleware('can:admin-company-edit')->only('update');
    }

    public function show(): JsonResponse
    {
        abort_unless(Tenant::id(), 403, 'This account is not associated with a company.');

        $settings = CompanySetting::where('company_id', Tenant::id())->firstOrFail();

        AuditService::view('CompanySetting', $settings->id, '');

        return response()->json(['data' => new CompanySettingResource($settings)]);
    }

    public function update(UpdateCompanySettingRequest $request): JsonResponse
    {
        abort_unless(Tenant::id(), 403, 'This account is not associated with a company.');

        $settings = CompanySetting::where('company_id', Tenant::id())->firstOrFail();

        $settings->update($request->validated());

        AuditService::edit('CompanySetting', $settings->id, '');

        return response()->json([
            'message' => 'Settings updated successfully',
            'data'    => new CompanySettingResource($settings->fresh()),
        ]);
    }
}
