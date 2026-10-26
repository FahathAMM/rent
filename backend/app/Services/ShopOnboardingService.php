<?php

namespace App\Services;

use App\Models\Administration\User;
use App\Models\Location;
use App\Models\RentalShop;
use App\Models\ShopMember;
use App\Models\ShopSettings;
use App\Models\SystemAdmin;
use App\Notifications\MarketplaceNotification;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Rental shop registration - the only way to become a vendor. A new shop
 * starts unverified and unpublished (see app-doc/marketplace/01-phase1-
 * architecture.md section 3.1). Its creator is the owner member from the
 * start (so they can upload documents and submit), but the shop-owner
 * role - and with it the vendor app's permissions - is only granted once
 * a platform admin verifies the shop.
 */
class ShopOnboardingService
{
    private const REQUIRED_DOCUMENT_TYPES = ['business_registration'];

    public function register(User $user, array $data): RentalShop
    {
        return DB::transaction(function () use ($user, $data) {
            $shop = RentalShop::create($data + [
                'owner_user_id' => $user->id,
                'slug' => Str::slug($data['name']) . '-' . Str::lower(Str::random(5)),
                'status' => RentalShop::STATUS_PENDING_REVIEW,
                'verification_status' => RentalShop::VERIFICATION_UNVERIFIED,
                'is_published' => false,
                'policies' => RentalShop::DEFAULT_POLICIES,
            ]);

            ShopMember::create([
                'shop_id' => $shop->id,
                'user_id' => $user->id,
                'role' => ShopMember::ROLE_OWNER,
                'status' => ShopMember::STATUS_ACTIVE,
                'accepted_at' => now(),
            ]);

            ShopSettings::createFor($shop->id);

            if (!empty($data['address_line_1']) || !empty($data['city'])) {
                Location::create([
                    'shop_id' => $shop->id,
                    'name' => "{$shop->name} - Main Branch",
                    'type' => 'branch',
                    'address' => $data['address_line_1'] ?? null,
                    'city' => $data['city'] ?? null,
                    'district' => $data['district'] ?? null,
                    'is_active' => true,
                ]);
            }

            return $shop->fresh();
        });
    }

    public function submitForVerification(RentalShop $shop): RentalShop
    {
        if ($shop->verification_status === RentalShop::VERIFICATION_VERIFIED) {
            throw ValidationException::withMessages(['status' => ['This shop is already verified.']]);
        }

        $uploadedTypes = $shop->verifications()->pluck('document_type')->all();
        $missing = array_diff(self::REQUIRED_DOCUMENT_TYPES, $uploadedTypes);
        if (!empty($missing)) {
            throw ValidationException::withMessages([
                'documents' => ['Missing required documents: ' . implode(', ', $missing)],
            ]);
        }

        $shop->update(['verification_status' => RentalShop::VERIFICATION_PENDING]);

        return $shop->fresh();
    }

    public function verify(SystemAdmin $admin, RentalShop $shop): RentalShop
    {
        DB::transaction(function () use ($shop, $admin) {
            $shop->update([
                'verification_status' => RentalShop::VERIFICATION_VERIFIED,
                'verified_at' => now(),
                'verified_by' => $admin->id,
                'status' => RentalShop::STATUS_ACTIVE,
                'is_published' => true,
                'published_at' => $shop->published_at ?: now(),
                'suspended_reason' => null,
            ]);

            $shop->owner?->assignRole('shop-owner');
        });

        AuditService::edit('RentalShop', $shop->id, $shop->name, null, ['verification_status' => 'verified', 'decided_by_admin_id' => $admin->id]);

        $shop->owner?->notify(new MarketplaceNotification(
            'shop_verified', 'Shop verified', "{$shop->name} is now verified and published on the marketplace.", '/vendor/dashboard',
        ));

        return $shop->fresh();
    }

    public function reject(SystemAdmin $admin, RentalShop $shop, string $reason): RentalShop
    {
        $shop->update([
            'verification_status' => RentalShop::VERIFICATION_REJECTED,
            'status' => RentalShop::STATUS_REJECTED,
            'suspended_reason' => $reason,
        ]);

        AuditService::edit('RentalShop', $shop->id, $shop->name, null, ['verification_status' => 'rejected', 'reason' => $reason, 'decided_by_admin_id' => $admin->id]);

        $shop->owner?->notify(new MarketplaceNotification(
            'shop_rejected', 'Shop verification rejected', "{$shop->name} was rejected: {$reason}", '/account/shops/new',
        ));

        return $shop->fresh();
    }

    public function suspend(SystemAdmin $admin, RentalShop $shop, string $reason): RentalShop
    {
        $shop->update([
            'status' => RentalShop::STATUS_SUSPENDED,
            'is_published' => false,
            'suspended_reason' => $reason,
        ]);

        AuditService::edit('RentalShop', $shop->id, $shop->name, null, ['status' => 'suspended', 'reason' => $reason, 'decided_by_admin_id' => $admin->id]);

        return $shop->fresh();
    }

    public function activate(SystemAdmin $admin, RentalShop $shop): RentalShop
    {
        if ($shop->verification_status !== RentalShop::VERIFICATION_VERIFIED) {
            throw ValidationException::withMessages(['status' => ['Only a verified shop can be reactivated.']]);
        }

        $shop->update([
            'status' => RentalShop::STATUS_ACTIVE,
            'is_published' => true,
            'published_at' => $shop->published_at ?: now(),
            'suspended_reason' => null,
        ]);

        AuditService::edit('RentalShop', $shop->id, $shop->name, null, ['status' => 'active', 'decided_by_admin_id' => $admin->id]);

        return $shop->fresh();
    }
}
