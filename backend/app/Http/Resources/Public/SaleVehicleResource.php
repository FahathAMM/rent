<?php

namespace App\Http\Resources\Public;

use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

/**
 * Column allow-list for the Buy page. Like Public\VehicleResource it never
 * includes registration_number, condition_notes or shop contact details, and
 * it knows nothing of rental pricing or what a car finally sold for.
 */
class SaleVehicleResource extends JsonResource
{
    public function toArray($request): array
    {
        $detail = $this->saleDetail;

        return [
            'id' => $this->id,
            'slug' => $this->slug,
            'title' => $this->title,
            'make' => $this->make,
            'model' => $this->model,
            'year' => $this->year,
            'variant' => $this->variant,
            'colour' => $this->colour,
            'colour_hex' => $this->whenLoaded('vehicleColour', fn () => $this->vehicleColour?->hex),
            'transmission' => $this->transmission,
            'fuel_type' => $this->fuel_type,
            'engine_capacity_cc' => $this->engine_capacity_cc,
            'seating_capacity' => $this->seating_capacity,
            'doors' => $this->doors,
            'air_conditioned' => $this->air_conditioned,
            'features' => $this->features,
            'description' => $this->description,
            'price' => $detail?->price,
            'currency' => $detail?->currency,
            'is_negotiable' => $detail?->is_negotiable,
            'mileage_km' => $detail?->mileage_km,
            'condition' => $detail?->condition,
            'owners_count' => $detail?->owners_count,
            'warranty_months' => $detail?->warranty_months,
            'brand' => $this->whenLoaded('brand', fn () => $this->brand ? [
                'id' => $this->brand->id,
                'name' => $this->brand->name,
                'slug' => $this->brand->slug,
                'logo_url' => $this->brand->logo_url,
            ] : null),
            'category' => $this->whenLoaded('category', fn () => [
                'id' => $this->category->id,
                'name' => $this->category->translate('name'),
                'slug' => $this->category->slug,
            ]),
            'shop' => $this->whenLoaded('shop', fn () => [
                'id' => $this->shop->id,
                'name' => $this->shop->name,
                'slug' => $this->shop->slug,
                'city' => $this->shop->city,
                'logo' => $this->shop->logo_url,
                'is_verified' => $this->shop->isVerified(),
                'rating_avg' => $this->shop->rating_avg,
            ]),
            'images' => $this->whenLoaded('images', fn () => $this->images->map(fn ($img) => [
                'url' => $img->attachment ? Storage::disk($img->attachment->disk)->url($img->attachment->file_path) : null,
                'is_primary' => $img->is_primary,
                'alt_text' => $img->alt_text,
            ])->values()),
            'is_featured' => $this->is_featured,
        ];
    }
}
