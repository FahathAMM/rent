<?php

namespace App\Http\Controllers\Api\Customer;

use App\Http\Controllers\Controller;
use App\Traits\JsonResponse as JsonResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** A customer's own notifications: bookings, payments and sale enquiries. The vendor side has Api\NotificationController. */
class NotificationController extends Controller
{
    use JsonResponseTrait;

    public function index(Request $request): JsonResponse
    {
        $customer = $request->user('customer');

        return response()->json([
            'record' => $customer->notifications()->orderByDesc('created_at')->paginate(min((int) $request->get('per_page', 20), 50)),
            'unread_count' => $customer->unreadNotifications()->count(),
            'message' => 'Notifications retrieved',
            'status' => true,
        ]);
    }

    public function markRead(Request $request, string $id): JsonResponse
    {
        $notification = $request->user('customer')->notifications()->where('id', $id)->first();
        abort_unless($notification, 404);

        $notification->markAsRead();

        return $this->response('Marked as read');
    }

    public function markAllRead(Request $request): JsonResponse
    {
        $request->user('customer')->unreadNotifications->markAsRead();

        return $this->response('All notifications marked as read');
    }
}
