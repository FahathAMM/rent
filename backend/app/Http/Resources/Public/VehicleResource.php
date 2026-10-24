<?php

namespace App\Http\Resources\Public;

use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

/**
 * Column allow-list for anonymous/public consumption. Deliberately never
 * includes registration_number, condition_notes, shop email/phone/tax_id,
 * or anything from owner_profiles/owner_verifications - see
 * app-doc/marketplace/02-data-model.md "vehicles" (PUB markers) and
 * app-doc/marketplace/05-ui-and-api-map.md "Response-shaping rule".
 */
class VehicleResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'slug' => $this->slug,
            'title' => $this->title,
            'make' => $this->make,
            'model' => $this->model,
            'year' => $this->year,
            'variant' => $this->variant,
            'colour' => $this->colour,
            'transmission' => $this->transmission,
            'fuel_type' => $this->fuel_type,
            'engine_capacity_cc' => $this->engine_capacity_cc,
            'seating_capacity' => $this->seating_capacity,
            'luggage_capacity' => $this->luggage_capacity,
            'doors' => $this->doors,
            'air_conditioned' => $this->air_conditioned,
            'features' => $this->features,
            'description' => $this->description,
            'category' => $this->whenLoaded('category', fn () => [
                'id' => $this->category->id,
                'name' => $this->category->name,
                'slug' => $this->category->slug,
            ]),
            'shop' => $this->whenLoaded('shop', fn () => [
                'id' => $this->shop->id,
                'name' => $this->shop->name,
                'slug' => $this->shop->slug,
                'city' => $this->shop->city,
                'logo' => $this->shop->logo,
                'is_verified' => $this->shop->isVerified(),
                'rating_avg' => $this->shop->rating_avg,
            ]),
            'pricing' => $this->whenLoaded('pricing', fn () => [
                'currency' => $this->pricing->currency,
                'daily_rate' => $this->pricing->daily_rate,
                'weekly_rate' => $this->pricing->weekly_rate,
                'monthly_rate' => $this->pricing->monthly_rate,
                'security_deposit' => $this->pricing->security_deposit,
                'deposit_method' => $this->pricing->deposit_method,
                'mileage_allowance_per_day_km' => $this->pricing->mileage_allowance_per_day_km,
                'driver_rate_per_day' => $this->pricing->driver_rate_per_day,
                'delivery_available' => $this->pricing->delivery_available,
                'min_rental_days' => $this->pricing->min_rental_days,
                'max_rental_days' => $this->pricing->max_rental_days,
            ]),
            'images' => $this->whenLoaded('images', fn () => $this->images->map(fn ($img) => [
                'url' => $img->attachment ? Storage::disk($img->attachment->disk)->url($img->attachment->file_path) : null,
                'is_primary' => $img->is_primary,
                'alt_text' => $img->alt_text,
            ])->values()),
            'rating_avg' => $this->rating_avg,
            'rating_count' => $this->rating_count,
            'booking_count' => $this->booking_count,
            'is_featured' => $this->is_featured,
        ];
    }
}
