<?php

namespace App\Http\Resources\Public;

use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Only ever used for status = published rows - a controller must filter
 * that itself, this resource does not re-check it. Never exposes the
 * reviewer's contact details, only their display name.
 */
class ReviewResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'rating' => $this->rating,
            'rating_cleanliness' => $this->rating_cleanliness,
            'rating_condition' => $this->rating_condition,
            'rating_value' => $this->rating_value,
            'rating_communication' => $this->rating_communication,
            'rating_accuracy' => $this->rating_accuracy,
            'title' => $this->title,
            'comment' => $this->comment,
            'owner_reply' => $this->owner_reply,
            'owner_replied_at' => $this->owner_replied_at?->toISOString(),
            'is_verified_booking' => $this->is_verified_booking,
            'helpful_count' => $this->helpful_count,
            'reviewer_name' => $this->whenLoaded('user', fn () => $this->user->name),
            'created_at' => $this->created_at->toISOString(),
        ];
    }
}
