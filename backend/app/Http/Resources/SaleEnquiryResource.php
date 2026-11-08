<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

/**
 * One enquiry, for both sides of the conversation. The buyer's contact details
 * appear only when the customer relation is loaded (the vendor side); the
 * deal appears only on the enquiry that became the sale.
 */
class SaleEnquiryResource extends JsonResource
{
    public function toArray($request): array
    {
        $image = $this->vehicle?->relationLoaded('images') ? ($this->vehicle->images->firstWhere('is_primary', true) ?? $this->vehicle->images->first()) : null;

        return [
            'id' => $this->id,
            'reference' => $this->reference,
            'type' => $this->type,
            'status' => $this->status,
            'closed_reason' => $this->closed_reason,
            'last_message_at' => $this->last_message_at?->toISOString(),
            'created_at' => $this->created_at?->toISOString(),
            'unread_count' => (int) ($this->unread_count ?? 0),
            'vehicle' => $this->vehicle ? [
                'id' => $this->vehicle->id,
                'title' => $this->vehicle->title,
                'slug' => $this->vehicle->slug,
                'year' => $this->vehicle->year,
                'image_url' => $image?->attachment ? Storage::disk($image->attachment->disk)->url($image->attachment->file_path) : null,
                'price' => $this->vehicle->saleDetail?->price,
                'currency' => $this->vehicle->saleDetail?->currency,
                'sale_status' => $this->vehicle->saleDetail?->sale_status,
            ] : null,
            'shop' => $this->whenLoaded('shop', fn () => $this->shop ? [
                'name' => $this->shop->name,
                'slug' => $this->shop->slug,
                'city' => $this->shop->city,
            ] : null),
            'customer' => $this->whenLoaded('customer', fn () => $this->customer ? [
                'name' => $this->customer->name,
                'email' => $this->customer->email,
                'phone' => $this->customer->phone,
            ] : null),
            'sale' => $this->whenLoaded('sale', fn () => $this->sale ? [
                'reference' => $this->sale->reference,
                'sold_at' => $this->sale->sold_at?->toISOString(),
            ] : null),
            'messages' => $this->whenLoaded('messages', fn () => $this->messages->map(fn ($m) => [
                'id' => $m->id,
                'sender_type' => $m->sender_type,
                'body' => $m->body,
                'read_at' => $m->read_at?->toISOString(),
                'created_at' => $m->created_at?->toISOString(),
            ])->values()),
        ];
    }
}
