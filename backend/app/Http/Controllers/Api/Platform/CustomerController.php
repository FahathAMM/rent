<?php

namespace App\Http\Controllers\Api\Platform;

use App\Http\Controllers\Controller;
use App\Http\Requests\Platform\ReasonRequest;
use App\Models\Customer;
use App\Models\SystemAdmin;
use App\Services\CustomerService;
use App\Traits\JsonResponse as JsonResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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

    public function show(Customer $customer): JsonResponse
    {
        $customer->load([
            'customerProfile',
            'bookings' => fn ($q) => $q->latest()->limit(20)->select('id', 'customer_id', 'booking_reference', 'status', 'vehicle_id', 'created_at'),
        ]);
        $customer->loadCount(['bookings', 'favorites', 'reviews']);

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
