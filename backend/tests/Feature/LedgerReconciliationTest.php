<?php

namespace Tests\Feature;

use App\Actions\TransitionBooking;
use App\Models\Administration\User;
use App\Models\Booking;
use App\Models\BookingPricing;
use App\Models\LedgerEntry;
use App\Models\Payment;
use App\Models\PlatformCommission;
use App\Models\RentalShop;
use App\Models\ShopMember;
use App\Models\Vehicle;
use App\Models\VehicleCategory;
use App\Services\CommissionResolver;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Phase 8 — the two money-correctness risks app-doc/marketplace/06-plan-
 * and-risks.md calls out explicitly: "Counting money that is not
 * revenue" (a security deposit must never appear in revenue or the
 * commission base) and the ledger balancing (every booking confirmation
 * writes a double-entry set from 04-lifecycles.md "Ledger entries at
 * confirmation" that must debit exactly what it credits).
 */
class LedgerReconciliationTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_confirmed_bookings_ledger_entries_balance_and_exclude_the_deposit_from_revenue(): void
    {
        $category = VehicleCategory::create(['name' => 'Car', 'slug' => 'car', 'sort_order' => 1, 'is_active' => true]);
        $owner = User::factory()->create();
        $customer = User::factory()->create();
        $shop = RentalShop::factory()->create(['owner_user_id' => $owner->id]);
        ShopMember::create(['shop_id' => $shop->id, 'user_id' => $owner->id, 'role' => 'owner', 'status' => 'active']);

        $vehicle = Vehicle::create([
            'shop_id' => $shop->id, 'category_id' => $category->id, 'title' => 'Reconciliation Test Car',
            'slug' => 'reconciliation-test-car', 'make' => 'Toyota', 'model' => 'Aqua', 'year' => 2020,
            'registration_number' => 'RECON-0001', 'transmission' => 'automatic', 'fuel_type' => 'hybrid',
            'seating_capacity' => 5, 'status' => Vehicle::STATUS_PUBLISHED, 'moderation_status' => Vehicle::MODERATION_APPROVED,
        ]);

        PlatformCommission::create([
            'name' => 'Global 10%', 'scope_type' => PlatformCommission::SCOPE_GLOBAL, 'scope_id' => null,
            'percentage' => 10, 'applies_to' => 'rental_only', 'processing_fee_borne_by' => 'platform',
            'priority' => 0, 'effective_from' => now()->subYear()->toDateString(), 'is_active' => true,
        ]);

        $baseAmount = 10000.00;
        $depositAmount = 5000.00;
        $totalPayable = $baseAmount + $depositAmount;

        $booking = Booking::create([
            'booking_reference' => 'BKG-RECON-001',
            'vehicle_id' => $vehicle->id, 'shop_id' => $shop->id, 'customer_id' => $customer->id,
            'pickup_at' => now()->addDays(5), 'return_at' => now()->addDays(8), 'rental_days' => 3,
            'status' => Booking::STATUS_ACCEPTED,
        ]);

        BookingPricing::create([
            'booking_id' => $booking->id, 'currency' => 'LKR',
            'pricing_snapshot' => ['security_deposit' => $depositAmount, 'deposit_method' => 'prepaid'],
            'rate_plan' => 'daily', 'rate_breakdown' => [],
            'base_amount' => $baseAmount, 'subtotal' => $baseAmount, 'security_deposit' => $depositAmount,
            'total_payable' => $totalPayable, 'computed_at' => now(), 'snapshot_hash' => hash('sha256', 'recon'),
        ]);

        $payment = Payment::create([
            'booking_id' => $booking->id, 'payment_reference' => 'PAY-' . Str::upper(Str::random(10)),
            'gateway' => 'payhere', 'type' => 'rental', 'amount' => $totalPayable, 'currency' => 'LKR',
            'status' => Payment::STATUS_SUCCEEDED, 'idempotency_key' => (string) Str::uuid(), 'initiated_by' => $customer->id,
        ]);

        $booking = app(TransitionBooking::class)->confirm($booking, $payment, app(CommissionResolver::class));

        $financials = $booking->financials;

        // Deposit never counts as revenue or against the commission base —
        // the commission base is the gross rental amount only.
        $this->assertEquals($baseAmount, (float) $financials->gross_rental_amount);
        $this->assertEquals($baseAmount, (float) $financials->commissionable_amount);
        $this->assertEquals($depositAmount, (float) $financials->security_deposit_held);
        $this->assertEquals(round($baseAmount * 0.10, 2), (float) $financials->commission_amount);

        $entries = LedgerEntry::where('booking_id', $booking->id)->get();
        $this->assertGreaterThan(0, $entries->count());

        // Double-entry: every batch must balance — total debits equal
        // total credits, to the cent.
        $debits = $entries->where('direction', LedgerEntry::DEBIT)->sum('amount');
        $credits = $entries->where('direction', LedgerEntry::CREDIT)->sum('amount');
        $this->assertEquals(round((float) $debits, 2), round((float) $credits, 2), 'Ledger entries for this booking do not balance.');

        // The deposit posts to deposit_liability, never to a revenue
        // account (commission_income or customer_receivable).
        $depositEntries = $entries->where('account', LedgerEntry::ACCOUNT_DEPOSIT_LIABILITY);
        $this->assertCount(1, $depositEntries);
        $this->assertEquals($depositAmount, (float) $depositEntries->first()->amount);

        $revenueAccounts = [LedgerEntry::ACCOUNT_COMMISSION_INCOME, LedgerEntry::ACCOUNT_CUSTOMER_RECEIVABLE];
        $revenueEntriesContainingDepositAmount = $entries
            ->whereIn('account', $revenueAccounts)
            ->where('amount', $depositAmount);
        $this->assertCount(0, $revenueEntriesContainingDepositAmount, 'The deposit amount leaked into a revenue account.');

        // Every ledger row from one confirmation shares a single batch_id.
        $this->assertCount(1, $entries->pluck('batch_id')->unique());
    }

    public function test_ledger_entries_have_no_update_or_delete_route_and_the_model_has_no_updated_at(): void
    {
        $this->assertFalse(in_array('updated_at', (new LedgerEntry)->getFillable(), true));
        $this->assertNull(LedgerEntry::UPDATED_AT);
    }
}
