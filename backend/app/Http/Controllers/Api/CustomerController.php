<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Customer\StoreCustomerRequest;
use App\Http\Requests\Customer\UpdateCustomerRequest;
use App\Models\Customer;
use App\Repositories\CustomerRepo;
use App\Services\AuditService;
use App\Traits\JsonResponse as JsonResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CustomerController extends Controller
{
    use JsonResponseTrait;

    public function __construct(private CustomerRepo $repo)
    {
        $this->middleware('can:sales-customers-view')->only(['index', 'show']);
        $this->middleware('can:sales-customers-create')->only('store');
        $this->middleware('can:sales-customers-edit')->only('update');
        $this->middleware('can:sales-customers-delete')->only('destroy');
    }

    public function index(Request $request): JsonResponse
    {
        return response()->json([
            'record'  => $this->repo->getData($request),
            'message' => 'Customers retrieved successfully',
            'status'  => true,
        ]);
    }

    public function store(StoreCustomerRequest $request): JsonResponse
    {
        $customer = $this->repo->store($request);

        AuditService::create('Customer', $customer->id, $customer->name);

        return $this->response('Customer created successfully', $customer, 201);
    }

    public function show(Customer $customer): JsonResponse
    {
        return $this->response('Customer retrieved successfully', $customer->loadCount('sales'));
    }

    public function update(UpdateCustomerRequest $request, Customer $customer): JsonResponse
    {
        $old = $customer->only($customer->getFillable());

        $customer = $this->repo->update($customer, $request);

        AuditService::edit('Customer', $customer->id, $customer->name, $old, $customer->only($customer->getFillable()));

        return $this->response('Customer updated successfully', $customer);
    }

    public function destroy(Customer $customer): JsonResponse
    {
        try {
            $name = $customer->name;
            $this->repo->destroy($customer);

            AuditService::delete('Customer', $customer->id, $name);

            return $this->response('Customer deleted successfully');
        } catch (\RuntimeException $e) {
            return $this->response($e->getMessage(), null, 422);
        }
    }
}
