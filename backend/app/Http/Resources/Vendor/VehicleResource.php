<?php

namespace App\Http\Resources\Vendor;

use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

/**
 * The owner/staff view of their own vehicle - the full record, including
 * registration_number (needed for the agreement/handover), plus
 * performance counters. Never reachable for a vehicle outside the active
 * shop context (ShopScope + VehiclePolicy enforce that before this is
 * ever constructed).
 */
class VehicleResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'shop_id' => $this->shop_id,
            'category_id' => $this->category_id,
            'brand_id' => $this->brand_id,
            'model_id' => $this->model_id,
            'variant_id' => $this->variant_id,
            'colour_id' => $this->colour_id,
            'title' => $this->title,
            'slug' => $this->slug,
            'make' => $this->make,
            'model' => $this->model,
            'year' => $this->year,
            'variant' => $this->variant,
            'colour' => $this->colour,
            'registration_number' => $this->registration_number,
            'transmission' => $this->transmission,
            'fuel_type' => $this->fuel_type,
            'engine_capacity_cc' => $this->engine_capacity_cc,
            'seating_capacity' => $this->seating_capacity,
            'luggage_capacity' => $this->luggage_capacity,
            'doors' => $this->doors,
            'air_conditioned' => $this->air_conditioned,
            'features' => $this->features,
            'description' => $this->description,
            'condition_notes' => $this->condition_notes,
            'status' => $this->status,
            'moderation_status' => $this->moderation_status,
            'moderation_note' => $this->moderation_note,
            'published_at' => $this->published_at?->toISOString(),
            'is_featured' => $this->is_featured,
            'pricing' => $this->whenLoaded('pricing'),
            'images' => $this->whenLoaded('images', fn () => $this->images->map(fn ($img) => [
                'id' => $img->id,
                'url' => $img->attachment ? Storage::disk($img->attachment->disk)->url($img->attachment->file_path) : null,
                'sort_order' => $img->sort_order,
                'is_primary' => $img->is_primary,
                'alt_text' => $img->alt_text,
            ])->values()),
            'pickup_locations' => $this->whenLoaded('pickupLocations'),
            'view_count' => $this->view_count,
            'inquiry_count' => $this->inquiry_count,
            'booking_count' => $this->booking_count,
            'rating_avg' => $this->rating_avg,
            'rating_count' => $this->rating_count,
            'created_at' => $this->created_at->toISOString(),
            'updated_at' => $this->updated_at->toISOString(),
        ];
    }
}
