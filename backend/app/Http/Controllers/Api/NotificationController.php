<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AuthUser;
use App\Traits\JsonResponse as JsonResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * One shared endpoint set for both the customer and vendor apps - a
 * notification belongs to the User model itself (Laravel's own
 * notifications table, notifiable_type/notifiable_id), never to a shop,
 * so there is no ShopScope concern here at all.
 */
class NotificationController extends Controller
{
    use JsonResponseTrait;

    public function index(Request $request): JsonResponse
    {
        $user = AuthUser::user();

        $notifications = $user->notifications()
            ->when($request->boolean('unread_only'), fn ($q) => $q->whereNull('read_at'))
            ->orderByDesc('created_at')
            ->paginate(min((int) $request->get('perPage', 20), 100));

        return response()->json([
            'record' => $notifications,
            'unread_count' => $user->unreadNotifications()->count(),
            'message' => 'Notifications retrieved',
            'status' => true,
        ]);
    }

    public function markRead(string $id): JsonResponse
    {
        $notification = AuthUser::user()->notifications()->where('id', $id)->first();
        abort_unless($notification, 404);

        $notification->markAsRead();

        return $this->response('Marked as read');
    }

    public function markAllRead(): JsonResponse
    {
        AuthUser::user()->unreadNotifications->markAsRead();

        return $this->response('All notifications marked as read');
    }
}
