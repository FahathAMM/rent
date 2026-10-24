<?php

namespace App\Http\Controllers\Api\Vendor;

use App\Http\Controllers\Controller;
use App\Http\Requests\Vehicle\UploadVehicleImageRequest;
use App\Models\Attachment;
use App\Models\Vehicle;
use App\Models\VehicleImage;
use App\Services\AuditService;
use App\Services\AuthUser;
use App\Traits\JsonResponse as JsonResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

/**
 * Listing photos - unlike KYC/business documents, these are public
 * (served from the 'public' disk, world-readable at /storage/...) since
 * they're what PublicVehicleQuery shows anonymous shoppers. Authorized
 * via VehiclePolicy's existing 'update' ability - managing a vehicle's
 * photos is part of managing the vehicle, not a separate permission.
 */
class VehicleImageController extends Controller
{
    use JsonResponseTrait;

    public function index(Vehicle $vehicle): JsonResponse
    {
        $this->authorize('view', $vehicle);

        return $this->response('Images retrieved', $vehicle->images()->with('attachment')->get()
            ->map(fn (VehicleImage $img) => $this->shape($img)));
    }

    public function store(UploadVehicleImageRequest $request, Vehicle $vehicle): JsonResponse
    {
        $this->authorize('update', $vehicle);

        $file = $request->file('file');
        $path = $file->store("vehicles/{$vehicle->id}", 'public');

        $attachment = Attachment::create([
            'shop_id' => $vehicle->shop_id,
            'uploaded_by' => AuthUser::id(),
            'file_name' => $file->getClientOriginalName(),
            'file_path' => $path,
            'disk' => 'public',
            'mime_type' => $file->getClientMimeType(),
            'file_size' => $file->getSize(),
            'attachable_type' => 'vehicle',
            'attachable_id' => $vehicle->id,
            'visibility' => Attachment::VISIBILITY_PUBLIC,
        ]);

        $isFirst = $vehicle->images()->count() === 0;
        $image = VehicleImage::create([
            'vehicle_id' => $vehicle->id,
            'attachment_id' => $attachment->id,
            'sort_order' => $vehicle->images()->max('sort_order') + 1,
            'is_primary' => $isFirst,
            'alt_text' => $request->validated('alt_text'),
        ]);

        AuditService::create('VehicleImage', $image->id, $attachment->file_name);

        return $this->response('Image uploaded', $this->shape($image->load('attachment')), 201);
    }

    public function destroy(VehicleImage $image): JsonResponse
    {
        $vehicle = $image->vehicle;
        $this->authorize('update', $vehicle);

        $wasPrimary = $image->is_primary;
        $attachment = $image->attachment;

        if ($attachment && Storage::disk($attachment->disk)->exists($attachment->file_path)) {
            Storage::disk($attachment->disk)->delete($attachment->file_path);
        }
        $image->delete();
        $attachment?->delete();

        if ($wasPrimary) {
            $next = $vehicle->images()->orderBy('sort_order')->first();
            $next?->update(['is_primary' => true]);
        }

        AuditService::delete('VehicleImage', $image->id, $attachment->file_name ?? 'image');

        return $this->response('Image deleted');
    }

    public function setPrimary(VehicleImage $image): JsonResponse
    {
        $vehicle = $image->vehicle;
        $this->authorize('update', $vehicle);

        $vehicle->images()->update(['is_primary' => false]);
        $image->update(['is_primary' => true]);

        return $this->response('Primary image updated');
    }

    public function reorder(Request $request, Vehicle $vehicle): JsonResponse
    {
        $this->authorize('update', $vehicle);

        $data = $request->validate(['image_ids' => ['required', 'array']]);
        $ids = $vehicle->images()->pluck('id')->all();

        if (count(array_diff($data['image_ids'], $ids)) > 0 || count(array_diff($ids, $data['image_ids'])) > 0) {
            throw ValidationException::withMessages(['image_ids' => ['Must list every image belonging to this vehicle exactly once.']]);
        }

        foreach ($data['image_ids'] as $position => $id) {
            VehicleImage::where('id', $id)->update(['sort_order' => $position]);
        }

        return $this->response('Order updated');
    }

    private function shape(VehicleImage $image): array
    {
        return [
            'id' => $image->id,
            'url' => $image->attachment ? Storage::disk($image->attachment->disk)->url($image->attachment->file_path) : null,
            'sort_order' => $image->sort_order,
            'is_primary' => $image->is_primary,
            'alt_text' => $image->alt_text,
        ];
    }
}
