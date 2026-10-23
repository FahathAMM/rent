<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Company\UpdateCompanyRequest;
use App\Http\Resources\CompanyResource;
use App\Models\Company;
use App\Services\AuditService;
use App\Support\Tenant;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;

class CompanyController extends Controller
{
    public function __construct()
    {
        $this->middleware('can:admin-company-edit')->only('update');
    }

    public function show(): JsonResponse
    {
        abort_unless(Tenant::id(), 403, 'This account is not associated with a company.');

        $company = Company::findOrFail(Tenant::id());

        AuditService::view('Company', $company->id, $company->name);

        return response()->json(['data' => new CompanyResource($company)]);
    }

    public function update(UpdateCompanyRequest $request): JsonResponse
    {
        abort_unless(Tenant::id(), 403, 'This account is not associated with a company.');

        $company = Company::findOrFail(Tenant::id());

        $data = $request->validated();
        unset($data['logo']);

        if ($request->hasFile('logo')) {
            if ($company->logo) {
                Storage::disk('public')->delete($company->logo);
            }
            $data['logo'] = $request->file('logo')->store('company-logos', 'public');
        }

        $company->update($data);

        AuditService::edit('Company', $company->id, $company->name);

        return response()->json([
            'message' => 'Company profile updated successfully',
            'data'    => new CompanyResource($company->fresh()),
        ]);
    }
}
