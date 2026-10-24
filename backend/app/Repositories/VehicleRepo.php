<?php

namespace App\Repositories;

use App\Http\Requests\Vehicle\StoreVehicleRequest;
use App\Http\Requests\Vehicle\UpdateVehicleRequest;
use App\Models\ListingModerationHistory;
use App\Models\Vehicle;
use App\Services\AuthUser;
use App\Support\VendorContext;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class VehicleRepo
{
    protected $model;

    public function __construct(Vehicle $model)
    {
        $this->model = $model;
    }

    public function getData(Request $request): LengthAwarePaginator
    {
        $sortable = ['title', 'status', 'booking_count', 'rating_avg', 'created_at'];
        $sort = in_array($request->sort_field, $sortable) ? $request->sort_field : 'created_at';
        $dir  = $request->sort_direction === 'asc' ? 'asc' : 'desc';

        return $this->model
            ->with('category', 'pricing', 'images.attachment')
            ->when($request->search, fn ($q) => $q->where(function ($qq) use ($request) {
                $qq->where('title', 'like', "%{$request->search}%")
                    ->orWhere('registration_number', 'like', "%{$request->search}%");
            }))
            ->when($request->status, fn ($q) => $q->where('status', $request->status))
            ->orderBy($sort, $dir)
            ->paginate(min($request->perPage ?? 20, 100));
    }

    public function store(StoreVehicleRequest $request): Vehicle
    {
        return DB::transaction(function () use ($request) {
            $data = $request->validated();
            $data['slug'] = $this->uniqueSlug($data['title']);
            $data['created_by'] = AuthUser::id();
            $data['status'] = Vehicle::STATUS_DRAFT;
            $data['moderation_status'] = Vehicle::MODERATION_PENDING;

            $vehicle = $this->model->create($data);

            $this->history($vehicle, null, Vehicle::STATUS_DRAFT, 'submitted');

            return $vehicle->fresh(['category']);
        });
    }

    public function update(Vehicle $vehicle, UpdateVehicleRequest $request): Vehicle
    {
        $data = $request->validated();

        if (isset($data['title']) && $data['title'] !== $vehicle->title) {
            $data['slug'] = $this->uniqueSlug($data['title'], $vehicle->id);
        }

        $vehicle->update($data);

        return $vehicle->fresh(['category', 'pricing']);
    }

    public function destroy(Vehicle $vehicle): void
    {
        $vehicle->delete();
    }

    public function publish(Vehicle $vehicle): Vehicle
    {
        $from = $vehicle->status;
        $vehicle->update(['status' => Vehicle::STATUS_PUBLISHED, 'published_at' => now()]);
        $this->history($vehicle, $from, Vehicle::STATUS_PUBLISHED, 'republished');

        return $vehicle->fresh();
    }

    public function unpublish(Vehicle $vehicle): Vehicle
    {
        $from = $vehicle->status;
        $vehicle->update(['status' => Vehicle::STATUS_UNPUBLISHED]);
        $this->history($vehicle, $from, Vehicle::STATUS_UNPUBLISHED, 'unpublished');

        return $vehicle->fresh();
    }

    public function archive(Vehicle $vehicle): Vehicle
    {
        $from = $vehicle->status;
        $vehicle->update(['status' => Vehicle::STATUS_ARCHIVED, 'archived_at' => now()]);
        $this->history($vehicle, $from, Vehicle::STATUS_ARCHIVED, 'archived');

        return $vehicle->fresh();
    }

    private function history(Vehicle $vehicle, ?string $from, string $to, string $action): void
    {
        ListingModerationHistory::create([
            'vehicle_id' => $vehicle->id,
            'from_status' => $from,
            'to_status' => $to,
            'action' => $action,
            'actor_type' => 'owner',
            'actor_id' => AuthUser::id(),
        ]);
    }

    /**
     * The slug column is globally unique (it is the public /vehicles/{slug}
     * URL, spanning every shop), unlike everything else on this model - so
     * this checks via a plain query builder call against the table
     * directly rather than an Eloquent scope bypass. Keeps
     * withoutGlobalScope(ShopScope) confined to App\Queries\Public* as the
     * one sanctioned pattern - see tests/Feature/PublicScopeBoundaryTest.php.
     */
    private function uniqueSlug(string $title, ?int $ignoreId = null): string
    {
        $base = Str::slug($title) . '-' . Str::lower(Str::random(5));
        $slug = $base;
        $i = 1;

        while (
            DB::table('vehicles')->where('slug', $slug)
                ->when($ignoreId, fn ($q) => $q->where('id', '!=', $ignoreId))
                ->exists()
        ) {
            $slug = "{$base}-{$i}";
            $i++;
        }

        return $slug;
    }
}
