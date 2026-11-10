<?php

namespace App\Services;

use App\Models\Administration\User;
use App\Models\Customer;
use App\Models\SaleEnquiry;
use App\Models\SaleEnquiryMessage;
use App\Models\Vehicle;
use App\Models\VehicleSaleDetail;
use App\Notifications\MarketplaceNotification;
use App\Queries\CustomerSaleQuery;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * A buyer's conversation with a shop about one car. One open enquiry per
 * customer per vehicle: asking again adds to it. See
 * app-doc/marketplace/13-vehicle-sales.md section 3.3.
 */
class SaleEnquiryService
{
    public function __construct(private SubscriptionService $subscriptions) {}

    /** Start an enquiry, or add to the customer's open one on this car. */
    public function open(Customer $customer, Vehicle $vehicle, string $body): SaleEnquiry
    {
        // A shop that lost the `sales` feature can't open its inbox, so it can't be sent a question it can't answer.
        abort_unless($this->subscriptions->hasFeature($vehicle->shop_id, 'sales'), 422, 'This shop is not taking enquiries right now.');

        $enquiry = DB::transaction(function () use ($customer, $vehicle, $body) {
            // The row lock is what makes "one open enquiry" hold when a buyer double-submits.
            VehicleSaleDetail::whereKey($vehicle->id)->lockForUpdate()->first();

            $enquiry = CustomerSaleQuery::openOn($customer->id, $vehicle->id);

            if (!$enquiry) {
                $enquiry = SaleEnquiry::create([
                    'reference' => 'ENQ-' . Str::upper(Str::random(6)),
                    'vehicle_id' => $vehicle->id,
                    'shop_id' => $vehicle->shop_id,
                    'customer_id' => $customer->id,
                    'status' => SaleEnquiry::STATUS_NEW,
                ]);
                // A plain table update: the customer side has no shop context for Vehicle's scope.
                DB::table('vehicles')->where('id', $vehicle->id)->increment('inquiry_count');
            }

            $this->addMessage($enquiry, SaleEnquiry::SENDER_CUSTOMER, $customer->id, $body);

            return $enquiry;
        });

        $vehicle->shop?->owner?->notify(new MarketplaceNotification(
            type: 'sale_enquiry_received',
            title: 'New sale enquiry',
            body: "{$customer->name} asked about \"{$vehicle->title}\".",
            actionUrl: "/vendor/sales/enquiries/{$enquiry->reference}",
        ));

        return $enquiry;
    }

    public function customerReply(SaleEnquiry $enquiry, Customer $customer, string $body): SaleEnquiryMessage
    {
        return $this->reply($enquiry, SaleEnquiry::SENDER_CUSTOMER, $customer->id, $body, SaleEnquiry::STATUS_NEW);
    }

    public function shopReply(SaleEnquiry $enquiry, User $user, string $body): SaleEnquiryMessage
    {
        $message = $this->reply($enquiry, SaleEnquiry::SENDER_SHOP, $user->id, $body, SaleEnquiry::STATUS_REPLIED);

        $enquiry->customer?->notify(new MarketplaceNotification(
            type: 'sale_enquiry_replied',
            title: 'The shop replied',
            body: 'You have a reply about your enquiry ' . $enquiry->reference . '.',
            actionUrl: "/account/enquiries/{$enquiry->reference}",
        ));

        return $message;
    }

    public function close(SaleEnquiry $enquiry, string $reason): SaleEnquiry
    {
        $this->assertOpen($enquiry);
        $enquiry->update(['status' => SaleEnquiry::STATUS_CLOSED, 'closed_reason' => $reason]);

        return $enquiry;
    }

    /** Close a car's open enquiries, telling each buyer why. */
    public function closeAllFor(Vehicle $vehicle, string $reason, ?int $exceptEnquiryId = null): void
    {
        SaleEnquiry::where('vehicle_id', $vehicle->id)->open()
            ->when($exceptEnquiryId, fn ($q) => $q->whereKeyNot($exceptEnquiryId))
            ->with('customer')
            ->get()
            ->each(function (SaleEnquiry $enquiry) use ($vehicle, $reason) {
                $enquiry->update(['status' => SaleEnquiry::STATUS_CLOSED, 'closed_reason' => $reason]);
                $enquiry->customer?->notify(new MarketplaceNotification(
                    type: 'sale_enquiry_closed',
                    title: 'Enquiry closed',
                    body: "Your enquiry about \"{$vehicle->title}\" was closed: {$reason}.",
                    actionUrl: "/account/enquiries/{$enquiry->reference}",
                ));
            });
    }

    /** Mark what the other side sent as read, when `$reader` opens the conversation. */
    public function markRead(SaleEnquiry $enquiry, string $reader): void
    {
        $enquiry->messages()->where('sender_type', '!=', $reader)->whereNull('read_at')->update(['read_at' => now()]);
    }

    private function reply(SaleEnquiry $enquiry, string $senderType, int $senderId, string $body, string $status): SaleEnquiryMessage
    {
        $this->assertOpen($enquiry);

        return DB::transaction(function () use ($enquiry, $senderType, $senderId, $body, $status) {
            $enquiry->update(['status' => $status]);

            return $this->addMessage($enquiry, $senderType, $senderId, $body);
        });
    }

    private function addMessage(SaleEnquiry $enquiry, string $senderType, int $senderId, string $body): SaleEnquiryMessage
    {
        $message = $enquiry->messages()->create(['sender_type' => $senderType, 'sender_id' => $senderId, 'body' => $body]);
        $enquiry->update(['last_message_at' => $message->created_at]);

        return $message;
    }

    private function assertOpen(SaleEnquiry $enquiry): void
    {
        if (!$enquiry->isOpen()) {
            throw ValidationException::withMessages(['enquiry' => [__('This enquiry is closed.')]]);
        }
    }
}
