<?php

namespace App\Http\Controllers\Api\Administration;

use App\Http\Controllers\Controller;
use App\Models\Administration\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuditLogController extends Controller
{
    /**
     * Shape matches UserController@index: the raw paginator under
     * "record", read by ServerDataTable as res.data.record.
     */
    public function index(Request $request): JsonResponse
    {
        $query = AuditLog::with('user:id,name,email')->where('action', '!=', 'view');

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
