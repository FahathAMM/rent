<?php

namespace App\Http\Resources\Public;

use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Never includes email, tax_id, business_registration_no, bank details or
 * verification documents - those live only in Vendor\* and Platform\*
 * resources.
 */
class ShopResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'slug' => $this->slug,
            'name' => $this->name,
            'shop_type' => $this->shop_type,
            'description' => $this->description,
            'tagline' => $this->tagline,
            'phone' => $this->phone,
            'whatsapp' => $this->whatsapp,
            'website' => $this->website,
            'city' => $this->city,
            'district' => $this->district,
            'latitude' => $this->latitude,
            'longitude' => $this->longitude,
            'operating_hours' => $this->operating_hours,
            'pickup_instructions' => $this->pickup_instructions,
            'return_instructions' => $this->return_instructions,
            'rental_terms' => $this->rental_terms,
            'cancellation_policy' => $this->cancellation_policy,
            'logo' => $this->logo,
            'cover_image' => $this->cover_image,
            'is_verified' => $this->isVerified(),
            'rating_avg' => $this->rating_avg,
            'rating_count' => $this->rating_count,
            'completed_bookings_count' => $this->completed_bookings_count,
            'response_rate' => $this->response_rate,
        ];
    }
}
