<?php

namespace App\Http\Controllers\Api\Platform;

use App\Http\Controllers\Controller;
use App\Http\Requests\Platform\ReasonRequest;
use App\Models\Administration\User;
use App\Models\SystemAdmin;
use App\Services\CustomerService;
use App\Traits\JsonResponse as JsonResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CustomerController extends Controller
{
    use JsonResponseTrait;

    public function __construct(private CustomerService $service) {}

    public function index(Request $request): JsonResponse
    {
        $users = User::withCount('bookings')
            ->with('roles:id,name')
            ->when($request->status, fn ($q) => $q->where('status', $request->status))
            ->when($request->role, fn ($q) => $q->whereHas('roles', fn ($r) => $r->where('name', $request->role)))
            ->when($request->search, fn ($q) => $q->where(fn ($w) => $w
                ->where('name', 'like', "%{$request->search}%")
                ->orWhere('email', 'like', "%{$request->search}%")))
            ->orderByDesc('created_at')
            ->paginate(min((int) $request->get('perPage', 20), 100));

        return response()->json(['record' => $users, 'message' => 'Customers retrieved', 'status' => true]);
    }

    public function show(User $user): JsonResponse
    {
        $user->load('roles:id,name', 'ownedShops:id,name,status', 'bookings:id,booking_reference,status,vehicle_id,created_at');
        $user->loadCount('bookings');

        return $this->response('Customer retrieved', $user);
    }

    public function suspend(ReasonRequest $request, User $user): JsonResponse
    {
        return $this->response('Account suspended', $this->service->suspend($this->admin(), $user, $request->validated('reason')));
    }

    public function ban(ReasonRequest $request, User $user): JsonResponse
    {
        return $this->response('Account banned', $this->service->ban($this->admin(), $user, $request->validated('reason')));
    }

    public function activate(User $user): JsonResponse
    {
        return $this->response('Account activated', $this->service->activate($this->admin(), $user));
    }

    private function admin(): SystemAdmin
    {
        /** @var SystemAdmin $admin */
        $admin = auth('platform')->user();

        return $admin;
    }
}
