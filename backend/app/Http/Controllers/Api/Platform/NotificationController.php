<?php

namespace App\Http\Controllers\Api\Platform;

use App\Http\Controllers\Controller;
use App\Traits\JsonResponse as JsonResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** The signed-in platform admin's own notifications (see PlatformNotifier). */
class NotificationController extends Controller
{
    use JsonResponseTrait;

    public function index(Request $request): JsonResponse
    {
        $admin = auth('platform')->user();

        return response()->json([
            'record' => $admin->notifications()
                ->when($request->boolean('unread_only'), fn ($q) => $q->whereNull('read_at'))
                ->orderByDesc('created_at')
                ->paginate(min((int) $request->get('perPage', 20), 100)),
            'unread_count' => $admin->unreadNotifications()->count(),
            'message' => 'Notifications retrieved',
            'status' => true,
        ]);
    }

    public function markRead(string $id): JsonResponse
    {
        $notification = auth('platform')->user()->notifications()->where('id', $id)->first();
        abort_unless($notification, 404);

        $notification->markAsRead();

        return $this->response('Marked as read');
    }

    public function markAllRead(): JsonResponse
    {
        auth('platform')->user()->unreadNotifications->markAsRead();

        return $this->response('All notifications marked as read');
    }
}
