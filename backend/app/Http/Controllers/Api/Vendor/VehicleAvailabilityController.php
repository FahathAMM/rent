<?php

namespace App\Http\Controllers\Api\Vendor;

use App\Http\Controllers\Controller;
use App\Http\Requests\Vendor\BlockAvailabilityRequest;
use App\Models\Vehicle;
use App\Models\VehicleAvailability;
use App\Services\AuditService;
use App\Traits\JsonResponse as JsonResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;

/**
 * The all-vehicle availability calendar. Vehicle (and so this controller,
 * via route-model binding) is already ShopScope-scoped — no manual
 * shop_id filter needed, same as every other vendor vehicle endpoint.
 */
class VehicleAvailabilityController extends Controller
{
    use JsonResponseTrait;

    public function __construct()
    {
        $this->middleware('can:vendor-vehicles-calendar-view')->only('index');
        $this->middleware('can:vendor-vehicles-calendar-edit')->only(['block', 'unblock']);
    }

    public function index(Request $request): JsonResponse
    {
        $from = $request->from ? Carbon::parse($request->from, config('app.timezone')) : now()->startOfMonth();
        $to = $request->to ? Carbon::parse($request->to, config('app.timezone')) : $from->copy()->addDays(41);

        $vehicles = Vehicle::forRent()->with(['images' => fn ($q) => $q->where('is_primary', true)->with('attachment')])
            ->orderBy('title')
            ->get(['id', 'title', 'registration_number']);

        $rows = VehicleAvailability::with('booking:id,booking_reference,status,customer_id', 'booking.customer:id,name')
            ->whereIn('vehicle_id', $vehicles->pluck('id'))
            ->whereBetween('date', [$from->toDateString(), $to->toDateString()])
            ->get(['id', 'vehicle_id', 'date', 'status', 'booking_id', 'note'])
            ->map(fn ($r) => [
                'id' => $r->id,
                'vehicle_id' => $r->vehicle_id,
                'date' => $r->date->toDateString(),
                'status' => $r->status,
                'note' => $r->note,
                // Booked days link back to their booking on the calendar.
                'booking' => $r->booking ? [
                    'reference' => $r->booking->booking_reference,
                    'status' => $r->booking->status,
                    'customer' => $r->booking->customer?->name,
                ] : null,
            ]);

        return $this->response('Availability retrieved', [
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
            'vehicles' => $vehicles,
            'rows' => $rows,
        ]);
    }

    public function block(BlockAvailabilityRequest $request, Vehicle $vehicle): JsonResponse
    {
        abort_if($vehicle->isForSale(), 404);

        $period = Carbon::parse($request->from, config('app.timezone'))->toPeriod($request->to);

        $alreadyBooked = VehicleAvailability::where('vehicle_id', $vehicle->id)
            ->whereBetween('date', [$request->from, $request->to])
            ->where('status', VehicleAvailability::STATUS_BOOKED)
            ->exists();

        throw_if($alreadyBooked, ValidationException::withMessages(['from' => ['This range overlaps a confirmed booking — unblock individual free dates instead.']]));

        foreach ($period as $date) {
            VehicleAvailability::updateOrCreate(
                ['vehicle_id' => $vehicle->id, 'date' => $date->toDateString()],
                ['status' => VehicleAvailability::STATUS_BLOCKED, 'note' => $request->note, 'created_by' => auth()->id()]
            );
        }

        AuditService::create('VehicleAvailability', $vehicle->id, "{$vehicle->title}: blocked {$request->from} → {$request->to}");

        return $this->response('Dates blocked');
    }

    public function unblock(Request $request, Vehicle $vehicle): JsonResponse
    {
        abort_if($vehicle->isForSale(), 404);

        $request->validate(['from' => ['required', 'date'], 'to' => ['required', 'date', 'after_or_equal:from']]);

        VehicleAvailability::where('vehicle_id', $vehicle->id)
            ->whereBetween('date', [$request->from, $request->to])
            ->where('status', VehicleAvailability::STATUS_BLOCKED)
            ->delete();

        AuditService::delete('VehicleAvailability', $vehicle->id, "{$vehicle->title}: unblocked {$request->from} → {$request->to}");

        return $this->response('Dates unblocked');
    }
}
