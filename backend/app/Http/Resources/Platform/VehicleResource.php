<?php

namespace App\Http\Resources\Platform;

use Illuminate\Http\Resources\Json\JsonResource;

/** Platform admin view - full record plus moderation history and the owning shop/owner identity. */
class VehicleResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'shop' => $this->whenLoaded('shop', fn () => [
                'id' => $this->shop->id,
                'name' => $this->shop->name,
                'owner_user_id' => $this->shop->owner_user_id,
                'verification_status' => $this->shop->verification_status,
            ]),
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
            'registration_number' => $this->registration_number,
            'status' => $this->status,
            'moderation_status' => $this->moderation_status,
            'moderation_note' => $this->moderation_note,
            'is_featured' => $this->is_featured,
            'rating_avg' => $this->rating_avg,
            'booking_count' => $this->booking_count,
            'moderation_history' => $this->whenLoaded('moderationHistory'),
            'created_at' => $this->created_at->toISOString(),
            'updated_at' => $this->updated_at->toISOString(),
        ];
    }
}
