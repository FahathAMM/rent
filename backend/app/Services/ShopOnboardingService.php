<?php

namespace App\Services;

use App\Models\Administration\User;
use App\Models\Location;
use App\Models\RentalShop;
use App\Models\ShopMember;
use App\Models\ShopSettings;
use App\Models\SystemAdmin;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Business shop registration - a shop_type = business RentalShop starts
 * unverified and unpublished (see app-doc/marketplace/01-phase1-
 * architecture.md section 3.1: unapproved owners/shops cannot publish
 * publicly visible listings unless the platform explicitly allows it).
 * A platform admin verifies it separately before it can go live.
 */
class ShopOnboardingService
{
    private const REQUIRED_DOCUMENT_TYPES = ['business_registration'];

    public function register(User $user, array $data): RentalShop
    {
        return DB::transaction(function () use ($user, $data) {
            $shop = RentalShop::create($data + [
                'owner_user_id' => $user->id,
                'shop_type' => RentalShop::TYPE_BUSINESS,
                'slug' => Str::slug($data['name']) . '-' . Str::lower(Str::random(5)),
                'status' => RentalShop::STATUS_PENDING_REVIEW,
                'verification_status' => RentalShop::VERIFICATION_UNVERIFIED,
                'is_published' => false,
            ]);

            ShopMember::create([
                'shop_id' => $shop->id,
                'user_id' => $user->id,
                'role' => ShopMember::ROLE_OWNER,
                'status' => ShopMember::STATUS_ACTIVE,
                'accepted_at' => now(),
            ]);

            ShopSettings::create(['shop_id' => $shop->id]);

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

            $user->assignRole('shop-owner');

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
        $shop->update([
            'verification_status' => RentalShop::VERIFICATION_VERIFIED,
            'verified_at' => now(),
            'verified_by' => $admin->id,
            'status' => RentalShop::STATUS_ACTIVE,
            'is_published' => true,
            'published_at' => $shop->published_at ?: now(),
            'suspended_reason' => null,
        ]);

        AuditService::edit('RentalShop', $shop->id, $shop->name, null, ['verification_status' => 'verified', 'decided_by_admin_id' => $admin->id]);

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
