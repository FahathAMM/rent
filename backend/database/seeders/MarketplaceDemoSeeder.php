<?php

namespace Database\Seeders;

use App\Models\Administration\User;
use App\Models\Booking;
use App\Models\BookingFinancial;
use App\Models\BookingPricing;
use App\Models\BookingStatusHistory;
use App\Models\CustomerProfile;
use App\Models\Location;
use App\Models\OwnerBankDetail;
use App\Models\OwnerPayout;
use App\Models\OwnerPayoutItem;
use App\Models\OwnerProfile;
use App\Models\Payment;
use App\Models\PlatformCommission;
use App\Models\RentalShop;
use App\Models\Review;
use App\Models\SecurityDeposit;
use App\Models\ShopMember;
use App\Models\ShopSettings;
use App\Models\Vehicle;
use App\Models\VehicleCategory;
use App\Models\VehiclePickupLocation;
use App\Models\VehiclePricing;
use App\Support\ShopAbility;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * Sri Lankan demo dataset: 3 registered rental shops, 2 individual
 * owners, ~15 vehicles across them, 5 customers, and bookings covering
 * every lifecycle state - see app-doc/marketplace/06-plan-and-risks.md
 * step 10. Gated to non-production by DatabaseSeeder; safe to re-run
 * (skips if a shop already exists rather than duplicating).
 *
 * No real image files exist for this demo, so vehicle_images/attachments
 * are intentionally left empty — the frontend should render a vehicle
 * with no photos gracefully rather than this seeder faking file uploads.
 */
class MarketplaceDemoSeeder extends Seeder
{
    private const PASSWORD = 'password';

    public function run(): void
    {
        if (RentalShop::query()->exists()) {
            $this->command?->info('Marketplace demo data already present — skipping.');
            return;
        }

        $this->seedGlobalCommission();
        $customers = $this->seedCustomers();
        $businessShops = $this->seedBusinessShops();
        $individualShops = $this->seedIndividualOwners();
        $vehicles = $this->seedVehicles($businessShops, $individualShops);
        $this->seedBookings($vehicles, $customers);

        $shopCount = count($businessShops) + count($individualShops);
        $this->command?->info("Seeded {$shopCount} shops, " . count($vehicles)
            . ' vehicles, ' . count($customers) . ' customers, and demo bookings.');
    }

    private function seedGlobalCommission(): void
    {
        PlatformCommission::create([
            'name' => 'Default marketplace commission',
            'scope_type' => PlatformCommission::SCOPE_GLOBAL,
            'percentage' => 12.00,
            'applies_to' => 'rental_only',
            'processing_fee_borne_by' => 'platform',
            'priority' => 0,
            'effective_from' => now()->subYear()->toDateString(),
            'is_active' => true,
            'notes' => 'Phase 1 demo default — see app-doc/marketplace/04-lifecycles.md "Commission model".',
        ]);
    }

    /** @return User[] */
    private function seedCustomers(): array
    {
        $names = [
            ['Amara Fernando', 'amara.fernando@example.com'],
            ['Sunil Jayawardena', 'sunil.jayawardena@example.com'],
            ['Priya Rajapaksa', 'priya.rajapaksa@example.com'],
            ['Dinesh Kumara', 'dinesh.kumara@example.com'],
            ['Nadeesha Wickramasinghe', 'nadeesha.wickramasinghe@example.com'],
        ];

        $customers = [];
        foreach ($names as [$name, $email]) {
            $user = $this->makeUser($name, $email);
            $user->assignRole('customer');

            CustomerProfile::create([
                'user_id' => $user->id,
                'licence_country' => 'Sri Lanka',
                'licence_issued_on' => now()->subYears(5)->toDateString(),
                'licence_expiry' => now()->addYears(3)->toDateString(),
                'licence_classes' => ['B1'],
                'city' => fake()->randomElement(['Colombo', 'Kandy', 'Galle', 'Negombo']),
                'verification_status' => 'verified',
                'verified_at' => now(),
            ]);

            $customers[] = $user;
        }

        return $customers;
    }

    /** @return RentalShop[] */
    private function seedBusinessShops(): array
    {
        $defs = [
            [
                'name' => 'Colombo Wheels', 'city' => 'Colombo', 'district' => 'Colombo',
                'owner' => ['Ruwan Mendis', 'ruwan.mendis@colombowheels.lk'],
                'staff' => ['Tharindu Silva', 'tharindu.silva@colombowheels.lk'],
            ],
            [
                'name' => 'Kandy Car Rentals', 'city' => 'Kandy', 'district' => 'Kandy',
                'owner' => ['Chaminda Bandara', 'chaminda.bandara@kandycars.lk'],
                'staff' => ['Isuru Gunawardena', 'isuru.gunawardena@kandycars.lk'],
            ],
            [
                'name' => 'Galle Coastal Rentals', 'city' => 'Galle', 'district' => 'Galle',
                'owner' => ['Lakmal de Silva', 'lakmal.desilva@gallecoastal.lk'],
                'staff' => null,
            ],
        ];

        $shops = [];
        foreach ($defs as $def) {
            [$ownerName, $ownerEmail] = $def['owner'];
            $owner = $this->makeUser($ownerName, $ownerEmail);
            $owner->assignRole(['customer', 'shop-owner']);

            $shop = RentalShop::create([
                'owner_user_id' => $owner->id,
                'shop_type' => RentalShop::TYPE_BUSINESS,
                'name' => $def['name'],
                'slug' => Str::slug($def['name']),
                'description' => "{$def['name']} is a trusted vehicle rental business operating in {$def['city']}, Sri Lanka.",
                'tagline' => 'Reliable rentals, fair prices.',
                'email' => $ownerEmail,
                'phone' => '0' . fake()->numerify('#########'),
                'whatsapp' => '0' . fake()->numerify('#########'),
                'city' => $def['city'],
                'district' => $def['district'],
                'operating_hours' => $this->defaultOperatingHours(),
                'pickup_instructions' => 'Please bring your NIC/passport and driving licence for verification at pickup.',
                'return_instructions' => 'Return the vehicle with the same fuel level as at pickup.',
                'rental_terms' => 'Minimum rental age 21. Full-to-full fuel policy unless otherwise agreed.',
                'cancellation_policy' => 'Free cancellation up to 48 hours before pickup.',
                'business_registration_no' => 'PV ' . fake()->numerify('########'),
                'status' => RentalShop::STATUS_ACTIVE,
                'verification_status' => RentalShop::VERIFICATION_VERIFIED,
                'is_published' => true,
                'payout_schedule' => 'monthly',
                'min_payout_threshold' => 5000,
            ]);

            ShopMember::create([
                'shop_id' => $shop->id, 'user_id' => $owner->id, 'role' => ShopMember::ROLE_OWNER,
                'status' => ShopMember::STATUS_ACTIVE, 'accepted_at' => now(),
            ]);

            ShopSettings::create(['shop_id' => $shop->id]);

            OwnerBankDetail::create([
                'shop_id' => $shop->id,
                'account_holder_name' => $ownerName,
                'bank_name' => fake()->randomElement(['Commercial Bank', 'Sampath Bank', 'HNB', 'Bank of Ceylon']),
                'branch_name' => $def['city'],
                'account_number' => fake()->numerify('##########'),
                'account_number_last4' => fake()->numerify('####'),
                'account_type' => 'savings',
                'is_primary' => true,
                'verification_status' => 'verified',
                'verified_at' => now(),
            ]);

            Location::create([
                'shop_id' => $shop->id, 'name' => "{$def['name']} - Main Branch", 'type' => 'branch',
                'address' => "123 Main Street, {$def['city']}", 'city' => $def['city'], 'district' => $def['district'],
                'country' => 'Sri Lanka', 'phone' => $shop->phone, 'is_active' => true,
            ]);

            if ($def['staff']) {
                [$staffName, $staffEmail] = $def['staff'];
                $staff = $this->makeUser($staffName, $staffEmail);
                $staff->assignRole(['customer', 'shop-staff']);

                ShopMember::create([
                    'shop_id' => $shop->id, 'user_id' => $staff->id, 'role' => ShopMember::ROLE_STAFF,
                    'abilities' => ShopAbility::presetFor('staff'),
                    'status' => ShopMember::STATUS_ACTIVE, 'accepted_at' => now(),
                ]);
            }

            $shops[] = $shop;
        }

        return $shops;
    }

    /** @return RentalShop[] auto-provisioned personal shops, one per individual owner */
    private function seedIndividualOwners(): array
    {
        $defs = [
            ['Nimal Perera', 'nimal.perera@example.com'],
            ['Kamal Jayasuriya', 'kamal.jayasuriya@example.com'],
        ];

        $shops = [];
        foreach ($defs as [$name, $email]) {
            $owner = $this->makeUser($name, $email);
            $owner->assignRole(['customer', 'vehicle-owner']);

            OwnerProfile::create([
                'user_id' => $owner->id,
                'applicant_type' => 'individual',
                'full_name' => $name,
                'nic_number' => fake()->numerify('############'),
                'date_of_birth' => now()->subYears(35)->toDateString(),
                'contact_phone' => '0' . fake()->numerify('#########'),
                'city' => fake()->randomElement(['Negombo', 'Matara']),
                'district' => fake()->randomElement(['Gampaha', 'Matara']),
                'status' => OwnerProfile::STATUS_APPROVED,
                'submitted_at' => now()->subDays(30),
                'approved_at' => now()->subDays(25),
                'terms_accepted_at' => now()->subDays(30),
            ]);

            // Auto-provisioned personal shop — see
            // app-doc/marketplace/01-phase1-architecture.md section 3.1.
            $shop = RentalShop::create([
                'owner_user_id' => $owner->id,
                'shop_type' => RentalShop::TYPE_INDIVIDUAL,
                'name' => "{$name}'s Vehicles",
                'slug' => Str::slug($name) . '-vehicles',
                'description' => "Individually owned vehicles listed by {$name}.",
                'email' => $email,
                'phone' => '0' . fake()->numerify('#########'),
                'city' => fake()->randomElement(['Negombo', 'Matara']),
                'status' => RentalShop::STATUS_ACTIVE,
                'verification_status' => RentalShop::VERIFICATION_VERIFIED,
                'is_published' => true,
                'payout_schedule' => 'manual',
            ]);

            ShopMember::create([
                'shop_id' => $shop->id, 'user_id' => $owner->id, 'role' => ShopMember::ROLE_OWNER,
                'status' => ShopMember::STATUS_ACTIVE, 'accepted_at' => now(),
            ]);

            ShopSettings::create(['shop_id' => $shop->id]);

            OwnerBankDetail::create([
                'shop_id' => $shop->id,
                'account_holder_name' => $name,
                'bank_name' => 'Peoples Bank',
                'account_number' => fake()->numerify('##########'),
                'account_number_last4' => fake()->numerify('####'),
                'is_primary' => true,
                'verification_status' => 'verified',
                'verified_at' => now(),
            ]);

            Location::create([
                'shop_id' => $shop->id, 'name' => 'Pickup Point', 'type' => 'pickup_point',
                'city' => $shop->city, 'country' => 'Sri Lanka', 'is_active' => true,
            ]);

            $shops[] = $shop;
        }

        return $shops;
    }

    /**
     * @param RentalShop[] $businessShops
     * @param RentalShop[] $individualShops
     * @return Vehicle[]
     */
    private function seedVehicles(array $businessShops, array $individualShops): array
    {
        $categories = VehicleCategory::pluck('id', 'slug');

        // [shop index into businessShops (0-2) or 'ind0'/'ind1', make, model, category slug, transmission, fuel, seats, daily_rate, deposit]
        $specs = [
            [0, 'Toyota', 'Aqua', 'car', 'automatic', 'hybrid', 5, 6500, 30000],
            [0, 'Toyota', 'Premio', 'car', 'automatic', 'petrol', 5, 7500, 35000],
            [0, 'Toyota', 'KDH', 'van', 'manual', 'diesel', 14, 12000, 50000],
            [0, 'Suzuki', 'Wagon R', 'car', 'automatic', 'petrol', 5, 5500, 25000],
            [0, 'Nissan', 'Caravan', 'van', 'manual', 'diesel', 12, 13500, 50000],
            [1, 'Suzuki', 'Alto', 'car', 'manual', 'petrol', 4, 4500, 20000],
            [1, 'Mitsubishi', 'Montero', 'suv', 'automatic', 'diesel', 7, 18000, 75000],
            [1, 'Toyota', 'Aqua', 'car', 'automatic', 'hybrid', 5, 6800, 30000],
            [1, 'Toyota', 'Coaster', 'minibus', 'manual', 'diesel', 29, 25000, 100000],
            [2, 'Toyota', 'Premio', 'car', 'automatic', 'petrol', 5, 7200, 35000],
            [2, 'Suzuki', 'Wagon R', 'car', 'automatic', 'petrol', 5, 5300, 25000],
            [2, 'Toyota', 'KDH', 'van', 'manual', 'diesel', 14, 11800, 50000],
            ['ind0', 'Suzuki', 'Alto', 'car', 'manual', 'petrol', 4, 4200, 20000],
            ['ind1', 'Toyota', 'Aqua', 'car', 'automatic', 'hybrid', 5, 6500, 30000],
            ['ind1', 'Honda', 'Vezel', 'suv', 'automatic', 'hybrid', 5, 15000, 60000],
        ];

        $vehicles = [];
        foreach ($specs as $i => [$shopKey, $make, $model, $catSlug, $transmission, $fuel, $seats, $dailyRate, $deposit]) {
            $shop = is_int($shopKey) ? $businessShops[$shopKey] : $individualShops[(int) substr($shopKey, 3)];
            $title = "{$make} {$model} - " . ucfirst($shop->city ?? 'Sri Lanka');
            $slug = Str::slug("{$title}-{$i}") . '-' . fake()->unique()->numerify('###');

            $vehicle = Vehicle::create([
                'shop_id' => $shop->id,
                'category_id' => $categories[$catSlug] ?? $categories['car'],
                'created_by' => $shop->owner_user_id,
                'title' => $title,
                'slug' => $slug,
                'make' => $make,
                'model' => $model,
                'year' => fake()->numberBetween(2017, 2024),
                'colour' => fake()->randomElement(['White', 'Silver', 'Black', 'Red', 'Blue']),
                'registration_number' => fake()->unique()->regexify('[A-Z]{2,3}-[0-9]{4}'),
                'transmission' => $transmission,
                'fuel_type' => $fuel,
                'seating_capacity' => $seats,
                'luggage_capacity' => max(1, intdiv($seats, 2)),
                'air_conditioned' => true,
                'features' => ['Air Conditioning', 'Bluetooth', 'Reverse Camera'],
                'description' => "Well-maintained {$make} {$model}, available for self-drive or with a driver.",
                'status' => Vehicle::STATUS_PUBLISHED,
                'moderation_status' => Vehicle::MODERATION_APPROVED,
                'published_at' => now()->subDays(fake()->numberBetween(5, 60)),
                'booking_count' => 0,
                'rating_avg' => 0,
            ]);

            VehiclePricing::create([
                'vehicle_id' => $vehicle->id,
                'daily_rate' => $dailyRate,
                'weekly_rate' => round($dailyRate * 6, -2),
                'monthly_rate' => round($dailyRate * 22, -2),
                'security_deposit' => $deposit,
                'deposit_method' => 'cash_on_pickup',
                'mileage_allowance_per_day_km' => 100,
                'excess_mileage_rate_per_km' => 30,
                'driver_rate_per_day' => round($dailyRate * 0.4, -2),
                'delivery_available' => true,
                'delivery_free_radius_km' => 5,
                'delivery_fee_per_km' => 50,
                'cleaning_fee' => 1000,
                'late_return_fee_per_hour' => round($dailyRate * 0.1, -2),
                'min_rental_days' => 1,
                'advance_notice_hours' => 4,
                'updated_by' => $shop->owner_user_id,
            ]);

            $location = Location::where('shop_id', $shop->id)->first();
            if ($location) {
                VehiclePickupLocation::create([
                    'vehicle_id' => $vehicle->id, 'location_id' => $location->id,
                    'is_default' => true, 'delivery_allowed' => true,
                ]);
            }

            $vehicles[] = $vehicle;
        }

        return $vehicles;
    }

    /**
     * @param Vehicle[] $vehicles
     * @param User[] $customers
     */
    private function seedBookings(array $vehicles, array $customers): void
    {
        $plan = [
            ['status' => Booking::STATUS_PENDING, 'vehicle' => 0, 'customer' => 0, 'daysFromNow' => 10, 'rentalDays' => 3],
            ['status' => Booking::STATUS_ACCEPTED, 'vehicle' => 1, 'customer' => 1, 'daysFromNow' => 7, 'rentalDays' => 4],
            ['status' => Booking::STATUS_CONFIRMED, 'vehicle' => 5, 'customer' => 2, 'daysFromNow' => 14, 'rentalDays' => 5],
            ['status' => Booking::STATUS_ACTIVE, 'vehicle' => 6, 'customer' => 3, 'daysFromNow' => -1, 'rentalDays' => 4],
            ['status' => Booking::STATUS_COMPLETED, 'vehicle' => 2, 'customer' => 4, 'daysFromNow' => -20, 'rentalDays' => 3, 'review' => true, 'payout' => true],
            ['status' => Booking::STATUS_COMPLETED, 'vehicle' => 9, 'customer' => 0, 'daysFromNow' => -35, 'rentalDays' => 2, 'review' => true],
            ['status' => Booking::STATUS_REJECTED, 'vehicle' => 10, 'customer' => 1, 'daysFromNow' => 5, 'rentalDays' => 2],
            ['status' => Booking::STATUS_EXPIRED, 'vehicle' => 8, 'customer' => 2, 'daysFromNow' => 20, 'rentalDays' => 2],
            ['status' => Booking::STATUS_CANCELLED_BY_CUSTOMER, 'vehicle' => 12, 'customer' => 3, 'daysFromNow' => 9, 'rentalDays' => 2],
            ['status' => Booking::STATUS_CANCELLED_BY_OWNER, 'vehicle' => 13, 'customer' => 4, 'daysFromNow' => 12, 'rentalDays' => 3],
            ['status' => Booking::STATUS_NO_SHOW, 'vehicle' => 4, 'customer' => 0, 'daysFromNow' => -4, 'rentalDays' => 2],
        ];

        $bookingNo = 1;
        foreach ($plan as $row) {
            $vehicle = $vehicles[$row['vehicle']]->load('pricing', 'shop');
            $customer = $customers[$row['customer']];
            $pickupAt = now()->addDays($row['daysFromNow'])->setTime(10, 0);
            $returnAt = $pickupAt->copy()->addDays($row['rentalDays']);

            $booking = Booking::create([
                'booking_reference' => sprintf('BKG-%s-%05d', now()->format('Y'), $bookingNo++),
                'vehicle_id' => $vehicle->id,
                'shop_id' => $vehicle->shop_id,
                'customer_id' => $customer->id,
                'pickup_address' => "{$vehicle->shop->name}, {$vehicle->shop->city}",
                'return_address' => "{$vehicle->shop->name}, {$vehicle->shop->city}",
                'pickup_at' => $pickupAt,
                'return_at' => $returnAt,
                'rental_days' => $row['rentalDays'],
                'with_driver' => false,
                'status' => $row['status'],
                'payment_status' => in_array($row['status'], [Booking::STATUS_CONFIRMED, Booking::STATUS_ACTIVE, Booking::STATUS_COMPLETED], true)
                    ? Booking::PAYMENT_PAID : Booking::PAYMENT_UNPAID,
                'owner_response_deadline_at' => $pickupAt->copy()->subDays(2),
                'payment_deadline_at' => $pickupAt->copy()->subHours(12),
                'customer_note' => 'Looking forward to the trip!',
            ]);

            $this->statusHistory($booking, null, Booking::STATUS_PENDING, 'customer', $customer->id);

            $baseAmount = (float) $vehicle->pricing->daily_rate * $row['rentalDays'];
            $deposit = (float) $vehicle->pricing->security_deposit;
            [$commissionAmount, $gatewayFee, $ownerPayable, $platformNet] = $this->splitRevenue($baseAmount);

            if (in_array($row['status'], [Booking::STATUS_CONFIRMED, Booking::STATUS_ACTIVE, Booking::STATUS_COMPLETED], true)) {
                BookingPricing::create([
                    'booking_id' => $booking->id,
                    'pricing_snapshot' => $vehicle->pricing->toArray(),
                    'rate_plan' => 'daily',
                    'rate_breakdown' => [['plan' => 'daily', 'units' => $row['rentalDays'], 'rate' => $vehicle->pricing->daily_rate]],
                    'base_amount' => $baseAmount,
                    'subtotal' => $baseAmount,
                    'security_deposit' => $deposit,
                    'total_payable' => $baseAmount + $deposit,
                    'computed_at' => $booking->created_at,
                    'snapshot_hash' => hash('sha256', $booking->booking_reference . $baseAmount),
                ]);

                $booking->update([
                    'accepted_at' => $booking->created_at,
                    'confirmed_at' => $booking->created_at,
                ]);
                $this->statusHistory($booking, Booking::STATUS_PENDING, Booking::STATUS_CONFIRMED, 'system', null);

                $isCompleted = $row['status'] === Booking::STATUS_COMPLETED;

                Payment::create([
                    'booking_id' => $booking->id,
                    'payment_reference' => 'PAY-' . Str::upper(Str::random(10)),
                    'gateway' => 'payhere',
                    'type' => 'rental',
                    'amount' => $baseAmount + $deposit,
                    'status' => Payment::STATUS_SUCCEEDED,
                    'method' => 'visa',
                    'method_detail' => ['brand' => 'visa', 'last4' => '4242'],
                    'paid_at' => $booking->created_at,
                    'idempotency_key' => Str::uuid()->toString(),
                    'initiated_by' => $customer->id,
                ]);

                BookingFinancial::create([
                    'booking_id' => $booking->id,
                    'customer_paid_amount' => $baseAmount + $deposit,
                    'security_deposit_held' => $deposit,
                    'gross_rental_amount' => $baseAmount,
                    'commissionable_amount' => $baseAmount,
                    'commission_rate' => 12.00,
                    'commission_amount' => $commissionAmount,
                    'payment_processing_fee' => $gatewayFee,
                    'processing_fee_borne_by' => 'platform',
                    'owner_payable_amount' => $ownerPayable,
                    'platform_net_amount' => $platformNet,
                    'settlement_status' => $isCompleted
                        ? (($row['payout'] ?? false) ? BookingFinancial::SETTLEMENT_PAID : BookingFinancial::SETTLEMENT_UNSETTLED)
                        : BookingFinancial::SETTLEMENT_NOT_ELIGIBLE,
                    'eligible_for_payout_at' => $isCompleted ? $returnAt->copy()->addDays(3) : null,
                ]);

                SecurityDeposit::create([
                    'booking_id' => $booking->id,
                    'amount_required' => $deposit,
                    'amount_collected' => $deposit,
                    'hold_method' => 'cash_on_pickup',
                    'status' => $isCompleted ? SecurityDeposit::STATUS_RELEASED : SecurityDeposit::STATUS_HELD,
                    'collected_at' => $booking->created_at,
                    'released_at' => $isCompleted ? $returnAt : null,
                ]);

                if ($row['status'] === Booking::STATUS_ACTIVE) {
                    $booking->update(['actual_pickup_at' => $pickupAt]);
                }

                if ($isCompleted) {
                    $booking->update([
                        'actual_pickup_at' => $pickupAt,
                        'actual_return_at' => $returnAt,
                        'completed_at' => $returnAt,
                        'review_eligible_until' => $returnAt->copy()->addDays(14),
                    ]);
                    $this->statusHistory($booking, Booking::STATUS_CONFIRMED, Booking::STATUS_COMPLETED, 'system', null);

                    $vehicle->increment('booking_count');

                    if ($row['review'] ?? false) {
                        $rating = fake()->numberBetween(4, 5);
                        Review::create([
                            'booking_id' => $booking->id,
                            'vehicle_id' => $vehicle->id,
                            'shop_id' => $vehicle->shop_id,
                            'user_id' => $customer->id,
                            'rating' => $rating,
                            'rating_cleanliness' => $rating,
                            'rating_condition' => $rating,
                            'rating_value' => $rating,
                            'rating_communication' => $rating,
                            'rating_accuracy' => $rating,
                            'comment' => 'Great experience, the vehicle was clean and the owner was responsive. Would rent again.',
                            'status' => Review::STATUS_PUBLISHED,
                        ]);
                        $vehicle->increment('rating_count');
                        $vehicle->update(['rating_avg' => $rating]);
                    }

                    if ($row['payout'] ?? false) {
                        $payout = OwnerPayout::create([
                            'payout_reference' => 'PO-' . now()->format('Y') . '-' . str_pad((string) $bookingNo, 5, '0', STR_PAD_LEFT),
                            'shop_id' => $vehicle->shop_id,
                            'period_start' => $returnAt->copy()->startOfMonth()->toDateString(),
                            'period_end' => $returnAt->copy()->endOfMonth()->toDateString(),
                            'gross_rental_amount' => $baseAmount,
                            'commission_amount' => $commissionAmount,
                            'processing_fee_amount' => 0,
                            'net_amount' => $ownerPayable,
                            'booking_count' => 1,
                            'status' => OwnerPayout::STATUS_PAID,
                            'payout_method' => 'bank_transfer',
                            'bank_detail_id' => OwnerBankDetail::where('shop_id', $vehicle->shop_id)->value('id'),
                            'approved_at' => $returnAt->copy()->addDays(4),
                            'paid_at' => $returnAt->copy()->addDays(5),
                            'evidence_reference' => 'BANKREF-' . fake()->numerify('########'),
                            'evidence_recorded_at' => $returnAt->copy()->addDays(5),
                        ]);

                        OwnerPayoutItem::create([
                            'payout_id' => $payout->id,
                            'booking_id' => $booking->id,
                            'financial_snapshot' => $booking->financials()->first()?->toArray() ?? [],
                            'gross_amount' => $baseAmount,
                            'commission_amount' => $commissionAmount,
                            'processing_fee_amount' => 0,
                            'net_amount' => $ownerPayable,
                        ]);
                    }
                }
            } elseif ($row['status'] === Booking::STATUS_REJECTED) {
                $booking->update(['rejected_at' => $booking->created_at, 'rejection_reason' => 'Vehicle unavailable for the requested dates.']);
                $this->statusHistory($booking, Booking::STATUS_PENDING, Booking::STATUS_REJECTED, 'owner', $vehicle->shop->owner_user_id);
            } elseif ($row['status'] === Booking::STATUS_EXPIRED) {
                $booking->update(['expired_at' => now(), 'expiry_reason' => 'owner_no_response']);
                $this->statusHistory($booking, Booking::STATUS_PENDING, Booking::STATUS_EXPIRED, 'system', null, 'owner_no_response');
            } elseif ($row['status'] === Booking::STATUS_CANCELLED_BY_CUSTOMER) {
                $booking->update(['accepted_at' => $booking->created_at, 'cancelled_at' => now(), 'cancelled_by_type' => 'customer',
                    'cancelled_by_id' => $customer->id, 'cancellation_reason' => 'Change of travel plans.']);
                $this->statusHistory($booking, Booking::STATUS_ACCEPTED, Booking::STATUS_CANCELLED_BY_CUSTOMER, 'customer', $customer->id);
            } elseif ($row['status'] === Booking::STATUS_CANCELLED_BY_OWNER) {
                $booking->update(['accepted_at' => $booking->created_at, 'cancelled_at' => now(), 'cancelled_by_type' => 'owner',
                    'cancelled_by_id' => $vehicle->shop->owner_user_id, 'cancellation_reason' => 'Vehicle required for maintenance.']);
                $this->statusHistory($booking, Booking::STATUS_ACCEPTED, Booking::STATUS_CANCELLED_BY_OWNER, 'owner', $vehicle->shop->owner_user_id);
            } elseif ($row['status'] === Booking::STATUS_NO_SHOW) {
                $booking->update(['accepted_at' => $booking->created_at, 'confirmed_at' => $booking->created_at]);
                $this->statusHistory($booking, Booking::STATUS_CONFIRMED, Booking::STATUS_NO_SHOW, 'owner', $vehicle->shop->owner_user_id);
            } elseif ($row['status'] === Booking::STATUS_ACCEPTED) {
                $booking->update(['accepted_at' => $booking->created_at]);
                $this->statusHistory($booking, Booking::STATUS_PENDING, Booking::STATUS_ACCEPTED, 'owner', $vehicle->shop->owner_user_id);
            }
        }
    }

    /** @return array{0: float, 1: float, 2: float, 3: float} [commission, gateway_fee, owner_payable, platform_net] */
    private function splitRevenue(float $baseAmount): array
    {
        $commission = round($baseAmount * 0.12, 2);
        $gatewayFee = round($baseAmount * 0.033, 2);
        $ownerPayable = round($baseAmount - $commission, 2);
        $platformNet = round($commission - $gatewayFee, 2);

        return [$commission, $gatewayFee, $ownerPayable, $platformNet];
    }

    private function statusHistory(Booking $booking, ?string $from, string $to, string $actorType, ?int $actorId, ?string $reason = null): void
    {
        BookingStatusHistory::create([
            'booking_id' => $booking->id, 'field' => 'status', 'from_value' => $from, 'to_value' => $to,
            'actor_type' => $actorType, 'actor_id' => $actorId, 'reason' => $reason,
        ]);
    }

    private function makeUser(string $name, string $email): User
    {
        return User::create([
            'name' => $name,
            'email' => $email,
            'password' => Hash::make(self::PASSWORD),
            'phone' => '0' . fake()->numerify('#########'),
            'status' => User::STATUS_ACTIVE,
            'email_verified_at' => now(),
            'registration_source' => 'demo_seeder',
        ]);
    }

    private function defaultOperatingHours(): array
    {
        $open = ['open' => '08:00', 'close' => '18:00', 'closed' => false];

        return [
            'mon' => $open, 'tue' => $open, 'wed' => $open, 'thu' => $open, 'fri' => $open,
            'sat' => $open, 'sun' => ['open' => '09:00', 'close' => '14:00', 'closed' => false],
        ];
    }
}
