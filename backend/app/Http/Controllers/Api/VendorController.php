<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Vendor\StoreVendorRequest;
use App\Http\Requests\Vendor\UpdateVendorRequest;
use App\Models\Vendor;
use App\Repositories\VendorRepo;
use App\Services\AuditService;
use App\Traits\JsonResponse as JsonResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class VendorController extends Controller
{
    use JsonResponseTrait;

    public function __construct(private VendorRepo $repo)
    {
        $this->middleware('can:purchasing-vendors-view')->only(['index', 'show']);
        $this->middleware('can:purchasing-vendors-create')->only('store');
        $this->middleware('can:purchasing-vendors-edit')->only('update');
        $this->middleware('can:purchasing-vendors-delete')->only('destroy');
    }

    public function index(Request $request): JsonResponse
    {
        return response()->json([
            'record'  => $this->repo->getData($request),
            'message' => 'Vendors retrieved successfully',
            'status'  => true,
        ]);
    }

    public function store(StoreVendorRequest $request): JsonResponse
    {
        $vendor = $this->repo->store($request);

        AuditService::create('Vendor', $vendor->id, $vendor->name);

        return $this->response('Vendor created successfully', $vendor, 201);
    }

    public function show(Vendor $vendor): JsonResponse
    {
        return $this->response('Vendor retrieved successfully', $vendor->loadCount('purchases'));
    }

    public function update(UpdateVendorRequest $request, Vendor $vendor): JsonResponse
    {
        $old = $vendor->only($vendor->getFillable());

        $vendor = $this->repo->update($vendor, $request);

        AuditService::edit('Vendor', $vendor->id, $vendor->name, $old, $vendor->only($vendor->getFillable()));

        return $this->response('Vendor updated successfully', $vendor);
    }

    public function destroy(Vendor $vendor): JsonResponse
    {
        try {
            $name = $vendor->name;
            $this->repo->destroy($vendor);

            AuditService::delete('Vendor', $vendor->id, $name);

            return $this->response('Vendor deleted successfully');
        } catch (\RuntimeException $e) {
            return $this->response($e->getMessage(), null, 422);
        } catch (\Throwable $th) {
            Log::error('VendorController@destroy', ['id' => $vendor->id, 'message' => $th->getMessage()]);

            return $this->response('Failed to delete vendor', null, 422);
        }
    }
}
