<?php

namespace App\Http\Controllers\Api\Platform;

use App\Http\Controllers\Controller;
use App\Http\Requests\Platform\StoreCompanyRequest;
use App\Http\Resources\Platform\PlatformAuditLogResource;
use App\Http\Resources\Platform\PlatformCompanyDetailResource;
use App\Http\Resources\UserResource;
use App\Models\Administration\AuditLog;
use App\Models\Administration\User;
use App\Models\Company;
use App\Models\CompanySetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class CompanyController extends Controller
{
    /**
     * Onboard a new company directly from the Platform admin console —
     * bypasses public self-signup. Inline on purpose: this project avoids
     * Action classes; the previous App\Actions\CreateCompanyAction this used
     * to delegate to never actually existed in the repo.
     */
    public function store(StoreCompanyRequest $request): JsonResponse
    {
        $data = $request->validated();

        $company = DB::transaction(function () use ($data) {
            // Only 'name' is guaranteed present — every other column is left
            // out entirely (rather than set to null) when not submitted, so
            // its DB default (e.g. country/currency) applies instead of
            // being overridden by an explicit null.
            $optional = array_intersect_key($data, array_flip([
                'legal_name', 'email', 'phone', 'website', 'trn',
                'address_line_1', 'address_line_2', 'city', 'emirate',
                'country', 'currency',
            ]));

            $company = Company::create($optional + [
                'name'   => $data['company_name'],
                'status' => 'active',
            ]);

            CompanySetting::create(['company_id' => $company->id]);

            $user = User::create([
                'company_id' => $company->id,
                'name'       => $data['name'],
                'email'      => $data['owner_email'],
                'phone'      => $data['owner_phone'] ?? null,
                'password'   => Hash::make($data['password']),
                'is_active'  => true,
            ]);

            $user->syncRoles(['owner']);

            return $company;
        });

        $company->load('latestSubscription.plan');

        AuditLog::create([
            'company_id'      => $company->id,
            'system_admin_id' => auth('platform')->id(),
            'action'          => 'create',
            'form'            => 'Company',
            'record_id'       => $company->id,
            'record'          => $company->name,
            'ip'              => request()->ip(),
            'browser'         => request()->userAgent(),
        ]);

        return response()->json([
            'message' => "{$company->name} created successfully",
            'data'    => $company,
        ], 201);
    }

    /**
     * Every company on the platform — intentionally unscoped by tenant
     * (Platform Admin is a system-level role, not a company user), with
     * search/status/subscription filters and pagination.
     */
    public function index(Request $request): JsonResponse
    {
        $query = Company::query()
            ->withCount(['users'])
            ->with(['latestSubscription.plan']);

        if ($search = $request->get('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%")
                  ->orWhere('legal_name', 'like', "%{$search}%")
                  ->orWhere('trn', 'like', "%{$search}%");
            });
        }

        if ($status = $request->get('status')) {
            $query->where('status', $status);
        }

        // if ($subscriptionStatus = $request->get('subscription_status')) {
        //     $query->whereHas('latestSubscription', fn ($q) => $q->where('status', $subscriptionStatus));
        // }

        $sortable = ['name', 'status', 'created_at'];
        $sort = in_array($request->get('sort'), $sortable) ? $request->get('sort') : 'created_at';
        $dir = $request->get('dir') === 'asc' ? 'asc' : 'desc';
        $query->orderBy($sort, $dir);

        $companies = $query->paginate((int) $request->get('per_page', 15))->withQueryString();

        AuditLog::create([
            'system_admin_id' => auth('platform')->id(),
            'action'          => 'view',
            'form'            => 'Company',
            'record_id'       => null,
            'record'          => '',
            'ip'              => request()->ip(),
            'browser'         => request()->userAgent(),
        ]);

        return response()->json([
            'record'  => $companies,
            'message' => 'Companies retrieved successfully',
            'status'  => true,
        ]);
    }

    public function show(Company $company): JsonResponse
    {
        $company->load(['latestSubscription.plan']);

        $company->stats = [
            'users' => DB::table('users')->where('company_id', $company->id)->whereNull('deleted_at')->count(),
        ];

        $users = User::withoutGlobalScopes()
            ->where('company_id', $company->id)
            ->with('roles')
            ->orderByDesc('created_at')
            ->get();

        $recentAuditLogs = AuditLog::where('company_id', $company->id)
            ->with('user:id,name,email')
            ->orderByDesc('created_at')
            ->limit(10)
            ->get();

        AuditLog::create([
            'company_id'      => $company->id,
            'system_admin_id' => auth('platform')->id(),
            'action'          => 'view',
            'form'            => 'Company',
            'record_id'       => $company->id,
            'record'          => $company->name,
            'ip'              => request()->ip(),
            'browser'         => request()->userAgent(),
        ]);

        return response()->json([
            'data' => [
                'company'          => new PlatformCompanyDetailResource($company),
                'users'            => UserResource::collection($users),
                'recent_audit_logs'=> PlatformAuditLogResource::collection($recentAuditLogs),
            ],
        ]);
    }

    public function users(Company $company): JsonResponse
    {
        $users = User::withoutGlobalScopes()
            ->where('company_id', $company->id)
            ->with('roles')
            ->where('is_active', true)
            ->orderBy('name')
            ->get();

        return response()->json(['data' => UserResource::collection($users)]);
    }

    public function suspend(Company $company): JsonResponse
    {
        $company->update(['status' => 'suspended']);

        AuditLog::create([
            'company_id'      => $company->id,
            'system_admin_id' => auth('platform')->id(),
            'action'          => 'suspend',
            'form'            => 'Company',
            'record_id'       => $company->id,
            'record'          => $company->name,
            'ip'              => request()->ip(),
            'browser'         => request()->userAgent(),
        ]);

        return response()->json([
            'message' => "{$company->name} has been suspended.",
            'data'    => new PlatformCompanyDetailResource($company->fresh()),
        ]);
    }

    public function activate(Company $company): JsonResponse
    {
        $company->update(['status' => 'active']);

        AuditLog::create([
            'company_id'      => $company->id,
            'system_admin_id' => auth('platform')->id(),
            'action'          => 'activate',
            'form'            => 'Company',
            'record_id'       => $company->id,
            'record'          => $company->name,
            'ip'              => request()->ip(),
            'browser'         => request()->userAgent(),
        ]);

        return response()->json([
            'message' => "{$company->name} has been activated.",
            'data'    => new PlatformCompanyDetailResource($company->fresh()),
        ]);
    }
}
