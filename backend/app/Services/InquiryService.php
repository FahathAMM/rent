<?php

namespace App\Services;

use App\Models\Administration\User;
use App\Models\Vehicle;
use App\Models\VehicleInquiry;
use App\Notifications\MarketplaceNotification;
use Illuminate\Http\Request;

/**
 * VehicleInquiry has no BelongsToShop/ShopScope - a contact-the-owner
 * form is reachable by an anonymous visitor or a logged-in customer with
 * no shop context, same reasoning as Review (see Review's docblock).
 * The vendor side filters shop_id explicitly instead.
 */
class InquiryService
{
    public function create(Vehicle $vehicle, ?User $user, Request $request, array $data): VehicleInquiry
    {
        $inquiry = VehicleInquiry::create($data + [
            'vehicle_id' => $vehicle->id,
            'shop_id' => $vehicle->shop_id,
            'user_id' => $user?->id,
            'status' => VehicleInquiry::STATUS_NEW,
            'ip' => $request->ip(),
        ]);

        $vehicle->shop?->owner?->notify(new MarketplaceNotification(
            type: 'inquiry_received',
            title: 'New inquiry',
            body: "Someone asked about \"{$vehicle->title}\".",
            actionUrl: '/vendor/inquiries',
        ));

        return $inquiry;
    }

    public function reply(User $user, VehicleInquiry $inquiry, string $replyMessage): VehicleInquiry
    {
        $inquiry->update([
            'status' => VehicleInquiry::STATUS_REPLIED,
            'reply_message' => $replyMessage,
            'replied_at' => now(),
            'replied_by' => $user->id,
        ]);

        return $inquiry->fresh();
    }
}
