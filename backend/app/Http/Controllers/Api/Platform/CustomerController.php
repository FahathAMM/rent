<?php

namespace App\Http\Controllers\Api\Platform;

use App\Http\Controllers\Controller;
use App\Http\Requests\Platform\ReasonRequest;
use App\Models\Booking;
use App\Models\BookingPricing;
use App\Models\Customer;
use App\Models\Dispute;
use App\Models\SystemAdmin;
use App\Services\CustomerService;
use App\Traits\JsonResponse as JsonResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

/** Platform admin view of customer accounts — the `customers` table, not vendor `users`. */
class CustomerController extends Controller
{
    use JsonResponseTrait;

    public function __construct(private CustomerService $service) {}

    public function index(Request $request): JsonResponse
    {
        $customers = Customer::withCount('bookings')
            ->when($request->status, fn ($q) => $q->where('status', $request->status))
            ->when($request->search, fn ($q) => $q->where(fn ($w) => $w
                ->where('name', 'like', "%{$request->search}%")
                ->orWhere('email', 'like', "%{$request->search}%")
                ->orWhere('phone', 'like', "%{$request->search}%")))
            ->orderByDesc('created_at')
            ->paginate(min((int) $request->get('perPage', 20), 100));

        return response()->json(['record' => $customers, 'message' => 'Customers retrieved', 'status' => true]);
    }

    /** Everything the platform customer detail page shows: profile, stats, recent bookings, reviews and disputes. */
    public function show(Customer $customer): JsonResponse
    {
        $customer->load([
            'customerProfile',
            'bookings' => fn ($q) => $q->latest()->limit(20)
                ->select('id', 'customer_id', 'booking_reference', 'status', 'payment_status', 'payment_method', 'vehicle_id', 'shop_id', 'pickup_at', 'return_at', 'rental_days', 'created_at')
                ->with('vehicle:id,title', 'shop:id,name', 'pricing:id,booking_id,currency,total_payable'),
            'reviews' => fn ($q) => $q->latest()->limit(10)
                ->select('id', 'user_id', 'vehicle_id', 'shop_id', 'rating', 'title', 'comment', 'status', 'created_at')
                ->with('vehicle:id,title', 'shop:id,name'),
        ]);
        $customer->loadCount(['bookings', 'favorites', 'reviews']);

        // Booking breakdown + money spent (completed trips only).
        $bookings = Booking::where('customer_id', $customer->id);
        $customer->setAttribute('stats', [
            'completed'  => (clone $bookings)->where('status', Booking::STATUS_COMPLETED)->count(),
            'upcoming'   => (clone $bookings)->whereIn('status', [Booking::STATUS_PENDING, Booking::STATUS_CONFIRMED, Booking::STATUS_ACTIVE])->count(),
            'cancelled'  => (clone $bookings)->whereIn('status', [Booking::STATUS_CANCELLED_BY_CUSTOMER, Booking::STATUS_CANCELLED_BY_OWNER, Booking::STATUS_CANCELLED_BY_ADMIN, Booking::STATUS_REJECTED, Booking::STATUS_EXPIRED])->count(),
            'no_show'    => (clone $bookings)->where('status', Booking::STATUS_NO_SHOW)->count(),
            'shops_used' => (clone $bookings)->distinct('shop_id')->count('shop_id'),
            'total_spent' => (float) BookingPricing::whereIn('booking_id', (clone $bookings)->where('status', Booking::STATUS_COMPLETED)->select('id'))->sum('total_payable'),
            'last_booking_at' => (clone $bookings)->max('created_at'),
        ]);

        $customer->setAttribute('avatar_url', $customer->avatar ? asset(Storage::url($customer->avatar)) : null);

        $customer->setAttribute('disputes', Dispute::where('raised_by_customer_id', $customer->id)
            ->latest()->limit(10)
            ->get(['id', 'dispute_reference', 'subject', 'status', 'created_at']));

        return $this->response('Customer retrieved', $customer);
    }

    public function suspend(ReasonRequest $request, Customer $customer): JsonResponse
    {
        return $this->response('Account suspended', $this->service->suspend($this->admin(), $customer, $request->validated('reason')));
    }

    public function ban(ReasonRequest $request, Customer $customer): JsonResponse
    {
        return $this->response('Account banned', $this->service->ban($this->admin(), $customer, $request->validated('reason')));
    }

    public function activate(Customer $customer): JsonResponse
    {
        return $this->response('Account activated', $this->service->activate($this->admin(), $customer));
    }

    private function admin(): SystemAdmin
    {
        /** @var SystemAdmin $admin */
        $admin = auth('platform')->user();

        return $admin;
    }
}
