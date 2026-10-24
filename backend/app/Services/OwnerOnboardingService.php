<?php

namespace App\Services;

use App\Models\Administration\User;
use App\Models\Location;
use App\Models\OwnerProfile;
use App\Models\RentalShop;
use App\Models\ShopMember;
use App\Models\ShopSettings;
use App\Models\SystemAdmin;
use App\Notifications\MarketplaceNotification;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * The individual-owner application lifecycle - see
 * app-doc/marketplace/01-phase1-architecture.md section 3.1 and
 * app-doc/marketplace/06-plan-and-risks.md step 10 for why approval
 * auto-provisions a personal shop rather than branching ownership into
 * two shapes.
 */
class OwnerOnboardingService
{
    private const REQUIRED_DOCUMENT_TYPES = ['nic_front', 'nic_back', 'driving_licence'];

    public function saveDraft(User $user, array $data): OwnerProfile
    {
        $profile = OwnerProfile::firstOrNew(['user_id' => $user->id]);

        if ($profile->exists && !in_array($profile->status, [OwnerProfile::STATUS_DRAFT, OwnerProfile::STATUS_INFO_REQUESTED], true)) {
            throw ValidationException::withMessages([
                'status' => ['Your application is already ' . $profile->status . ' and can no longer be edited.'],
            ]);
        }

        $profile->fill($data + ['user_id' => $user->id, 'applicant_type' => 'individual']);
        if (!$profile->status) {
            $profile->status = OwnerProfile::STATUS_DRAFT;
        }
        $profile->save();

        return $profile;
    }

    public function submit(OwnerProfile $profile): OwnerProfile
    {
        if (!in_array($profile->status, [OwnerProfile::STATUS_DRAFT, OwnerProfile::STATUS_INFO_REQUESTED], true)) {
            throw ValidationException::withMessages(['status' => ['This application cannot be submitted from its current state.']]);
        }

        $uploadedTypes = $profile->verifications()->pluck('document_type')->all();
        $missing = array_diff(self::REQUIRED_DOCUMENT_TYPES, $uploadedTypes);
        if (!empty($missing)) {
            throw ValidationException::withMessages([
                'documents' => ['Missing required documents: ' . implode(', ', $missing)],
            ]);
        }

        $profile->update([
            'status' => OwnerProfile::STATUS_SUBMITTED,
            'submitted_at' => now(),
            'info_requested_note' => null,
        ]);

        return $profile->fresh();
    }

    public function approve(SystemAdmin $admin, OwnerProfile $profile): OwnerProfile
    {
        return DB::transaction(function () use ($admin, $profile) {
            $profile->update([
                'status' => OwnerProfile::STATUS_APPROVED,
                'reviewed_by' => $admin->id,
                'reviewed_at' => now(),
                'approved_at' => now(),
                'rejection_reason' => null,
            ]);

            $user = $profile->user;
            $user->assignRole('vehicle-owner');

            // Auto-provision the personal shop - see class docblock. Only
            // once: re-approving after a suspension must not create a
            // second shop for the same owner.
            if (!RentalShop::where('owner_user_id', $user->id)->where('shop_type', RentalShop::TYPE_INDIVIDUAL)->exists()) {
                $shop = RentalShop::create([
                    'owner_user_id' => $user->id,
                    'shop_type' => RentalShop::TYPE_INDIVIDUAL,
                    'name' => "{$profile->full_name}'s Vehicles",
                    'slug' => Str::slug($profile->full_name) . '-' . Str::lower(Str::random(5)),
                    'email' => $user->email,
                    'phone' => $profile->contact_phone,
                    'city' => $profile->city,
                    'district' => $profile->district,
                    'latitude' => $profile->latitude,
                    'longitude' => $profile->longitude,
                    'status' => RentalShop::STATUS_ACTIVE,
                    'verification_status' => RentalShop::VERIFICATION_VERIFIED,
                    'verified_at' => now(),
                    'verified_by' => $admin->id,
                    'is_published' => true,
                    'payout_schedule' => 'manual',
                ]);

                ShopMember::create([
                    'shop_id' => $shop->id,
                    'user_id' => $user->id,
                    'role' => ShopMember::ROLE_OWNER,
                    'status' => ShopMember::STATUS_ACTIVE,
                    'accepted_at' => now(),
                ]);

                ShopSettings::createFor($shop->id);

                Location::create([
                    'shop_id' => $shop->id,
                    'name' => 'Pickup Point',
                    'type' => 'pickup_point',
                    'city' => $profile->city,
                    'district' => $profile->district,
                    'is_active' => true,
                ]);
            }

            AuditService::edit('OwnerProfile', $profile->id, $profile->full_name, null, ['status' => 'approved']);

            $user->notify(new MarketplaceNotification(
                'owner_application_approved', 'Application approved', "You're now a verified vehicle owner — list your first vehicle to get started.", '/vendor/vehicles',
            ));

            return $profile->fresh();
        });
    }

    public function reject(SystemAdmin $admin, OwnerProfile $profile, string $reason): OwnerProfile
    {
        $profile->update([
            'status' => OwnerProfile::STATUS_REJECTED,
            'reviewed_by' => $admin->id,
            'reviewed_at' => now(),
            'rejection_reason' => $reason,
        ]);

        AuditService::edit('OwnerProfile', $profile->id, $profile->full_name, null, ['status' => 'rejected', 'reason' => $reason]);

        $profile->user?->notify(new MarketplaceNotification(
            'owner_application_rejected', 'Application rejected', "Your owner application was rejected: {$reason}", '/account/become-owner',
        ));

        return $profile->fresh();
    }

    public function requestInfo(SystemAdmin $admin, OwnerProfile $profile, string $note): OwnerProfile
    {
        $profile->update([
            'status' => OwnerProfile::STATUS_INFO_REQUESTED,
            'reviewed_by' => $admin->id,
            'reviewed_at' => now(),
            'info_requested_note' => $note,
            'info_requested_at' => now(),
        ]);

        AuditService::edit('OwnerProfile', $profile->id, $profile->full_name, null, ['status' => 'info_requested', 'note' => $note]);

        return $profile->fresh();
    }

    public function suspend(SystemAdmin $admin, OwnerProfile $profile, string $reason): OwnerProfile
    {
        if ($profile->status !== OwnerProfile::STATUS_APPROVED) {
            throw ValidationException::withMessages(['status' => ['Only an approved owner can be suspended.']]);
        }

        $profile->update([
            'status' => OwnerProfile::STATUS_SUSPENDED,
            'reviewed_by' => $admin->id,
            'reviewed_at' => now(),
            'suspended_at' => now(),
            'suspension_reason' => $reason,
        ]);

        AuditService::edit('OwnerProfile', $profile->id, $profile->full_name, null, ['status' => 'suspended', 'reason' => $reason]);

        return $profile->fresh();
    }
}
