<?php

namespace App\Http\Controllers\Api\Administration;

use App\Http\Controllers\Controller;
use App\Models\Administration\AuditLog;
use App\Support\VendorContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * A shop's own audit trail. AuditLog is deliberately NOT shop-scoped via
 * BelongsToShop/ShopScope (a platform admin action often has no single
 * shop context - see the model), so this endpoint scopes explicitly by
 * the active shop context instead of relying on a global scope. Without
 * this where() a vendor would see every shop's audit rows.
 */
class AuditLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = AuditLog::with('user:id,name,email')
            ->where('shop_id', VendorContext::shopId())
            ->where('action', '!=', 'view');

        if ($search = $request->get('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('form', 'like', "%{$search}%")
                  ->orWhere('record', 'like', "%{$search}%")
                  ->orWhere('action', 'like', "%{$search}%")
                  ->orWhereHas('user', fn ($u) => $u->where('name', 'like', "%{$search}%"));
            });
        }

        if ($form = $request->get('form')) {
            $query->where('form', $form);
        }
        if ($action = $request->get('action')) {
            $query->where('action', $action);
        }

        $sortable = ['form', 'action', 'record_id', 'created_at'];
        $sort = in_array($request->sort_field, $sortable) ? $request->sort_field : 'created_at';
        $dir  = $request->sort_direction === 'asc' ? 'asc' : 'desc';
        $query->orderBy($sort, $dir);

        $logs = $query->paginate($request->get('perPage', 20));

        return response()->json([
            'record'  => $logs,
            'message' => 'Audit logs retrieved successfully',
            'status'  => true,
        ]);
    }
}
