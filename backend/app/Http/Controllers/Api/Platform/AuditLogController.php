<?php

namespace App\Http\Controllers\Api\Platform;

use App\Http\Controllers\Controller;
use App\Http\Resources\Platform\PlatformAuditLogResource;
use App\Models\Administration\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuditLogController extends Controller
{
    /**
     * The full platform-wide system/security audit trail. Supports the
     * filter set the platform UI exposes: shop, user, event, model, date
     * range and search, all paginated.
     *
     * Shape matches other admin index endpoints: the raw paginator under
     * "record", read by ServerDataTable as res.data.record.
     */
    public function index(Request $request): JsonResponse
    {
        $query = AuditLog::query()->with(['shop:id,name', 'user:id,name,email', 'systemAdmin:id,name']);

        if ($shopId = $request->get('shop_id')) {
            $query->where('shop_id', $shopId);
        }

        if ($userId = $request->get('user_id')) {
            $query->where('user_id', $userId);
        }

        if ($event = $request->get('event')) {
            $query->where('action', $event);
        }

        if ($model = $request->get('model')) {
            $query->where('form', $model);
        }

        if ($severity = $request->get('severity')) {
            $query->where('severity', $severity);
        }

        if ($from = $request->get('date_from')) {
            $query->whereDate('created_at', '>=', $from);
        }

        if ($to = $request->get('date_to')) {
            $query->whereDate('created_at', '<=', $to);
        }

        if ($search = $request->get('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('record', 'like', "%{$search}%")
                  ->orWhere('form', 'like', "%{$search}%")
                  ->orWhereHas('shop', fn ($s) => $s->where('name', 'like', "%{$search}%"))
                  ->orWhereHas('user', fn ($u) => $u->where('name', 'like', "%{$search}%"));
            });
        }

        $sortable = ['created_at', 'action', 'form'];
        $sort = in_array($request->get('sort_field'), $sortable) ? $request->get('sort_field') : 'created_at';
        $dir = $request->get('sort_direction') === 'asc' ? 'asc' : 'desc';
        $query->orderBy($sort, $dir);

        $logs = $query->paginate((int) $request->get('perPage', 20));
        $logs->through(fn (AuditLog $log) => (new PlatformAuditLogResource($log))->resolve());

        return response()->json([
            'record'  => $logs,
            'message' => 'Audit logs retrieved successfully',
            'status'  => true,
        ]);
    }
}
