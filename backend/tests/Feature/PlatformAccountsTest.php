<?php

namespace Tests\Feature;

use App\Models\Administration\AuditLog;
use App\Models\Administration\User;
use App\Models\PlatformExpense;
use App\Models\Promotion;
use App\Models\RentalShop;
use App\Models\SubscriptionPayment;
use App\Models\SubscriptionPlan;
use App\Models\SystemAdmin;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/** /platform/accounts — the platform's own money in (subscriptions, promotions) and out (its expenses). Platform Owner only. */
class PlatformAccountsTest extends TestCase
{
    use RefreshDatabase;

    private RentalShop $shop;

    protected function setUp(): void
    {
        parent::setUp();

        $this->shop = RentalShop::factory()->create(['owner_user_id' => User::factory()->create()->id, 'name' => 'Lanka Rides']);
    }

    private function as(SystemAdmin $admin)
    {
        $this->app['auth']->forgetGuards();

        return $this->withHeader('Authorization', 'Bearer ' . $admin->createToken('t')->plainTextToken)->withHeader('Accept', 'application/json');
    }

    private function subscriptionPayment(string $status, float $amount, $reviewedAt = null): SubscriptionPayment
    {
        return SubscriptionPayment::create([
            'reference_no' => 'SUB-' . Str::upper(Str::random(8)), 'shop_id' => $this->shop->id,
            'plan_id' => SubscriptionPlan::where('code', 'pro')->value('id'), 'periods' => 1, 'amount' => $amount,
            'status' => $status, 'reviewed_at' => $reviewedAt,
        ]);
    }

    private function promotion(string $status, string $kind, float $amount, $reviewedAt = null): Promotion
    {
        return Promotion::create([
            'reference_no' => 'PRM-' . Str::upper(Str::random(8)), 'shop_id' => $this->shop->id, 'type' => Promotion::TYPE_SPONSORED,
            'city' => 'Kandy', 'days' => 7, 'amount' => $amount, 'kind' => $kind, 'status' => $status, 'reviewed_at' => $reviewedAt,
        ]);
    }

    public function test_only_the_platform_owner_can_open_the_accounts(): void
    {
        $admin = SystemAdmin::factory()->create();

        $this->as($admin)->getJson('/api/platform/accounts/summary')->assertForbidden();
        $this->as($admin)->getJson('/api/platform/accounts/transactions')->assertForbidden();
        $this->as($admin)->getJson('/api/platform/accounts/transactions/export')->assertForbidden();
        $this->as($admin)->getJson('/api/platform/accounts/expenses')->assertForbidden();
        $this->as($admin)->postJson('/api/platform/accounts/expenses', ['expense_date' => now()->toDateString(), 'category' => 'hosting', 'amount' => 100])->assertForbidden();
        $this->assertSame(0, PlatformExpense::count());
    }

    public function test_summary_counts_approved_money_in_and_recorded_expenses(): void
    {
        $this->subscriptionPayment(SubscriptionPayment::STATUS_APPROVED, 2500, now());
        $this->subscriptionPayment(SubscriptionPayment::STATUS_PENDING, 6000);            // not checked yet
        $this->subscriptionPayment(SubscriptionPayment::STATUS_REJECTED, 500, now());     // never received
        $this->subscriptionPayment(SubscriptionPayment::STATUS_APPROVED, 900, now()->subYears(2)); // outside the period
        $this->promotion(Promotion::STATUS_APPROVED, Promotion::KIND_PAID, 8000, now());
        $this->promotion(Promotion::STATUS_APPROVED, Promotion::KIND_GRANTED, 0, now());  // given free
        $this->promotion(Promotion::STATUS_PENDING, Promotion::KIND_PAID, 1000);

        $owner = SystemAdmin::factory()->owner()->create();
        $this->as($owner)->postJson('/api/platform/accounts/expenses', [
            'expense_date' => now()->toDateString(), 'category' => 'hosting', 'paid_to' => 'Hostinger', 'amount' => 3000,
        ])->assertCreated();

        $res = $this->as($owner)->getJson('/api/platform/accounts/summary')->assertOk();

        $this->assertEquals(10500, $res->json('data.income.total'));
        $this->assertEquals(2500, $res->json('data.income.subscriptions.amount'));
        $this->assertSame(1, $res->json('data.income.subscriptions.count'));
        $this->assertEquals(8000, $res->json('data.income.promotions.amount'));
        $this->assertEquals(3000, $res->json('data.expenses.total'));
        $this->assertEquals(7500, $res->json('data.net'));
        $this->assertSame(2, $res->json('data.pending.count'));
        $this->assertEquals(7000, $res->json('data.pending.amount'));
        $this->assertSame('Lanka Rides', $res->json('data.top_shops.0.name'));
        $this->assertEquals(10500, $res->json('data.top_shops.0.amount'));
        $this->assertSame('hosting', $res->json('data.expense_categories.0.category'));

        $thisMonth = collect($res->json('data.months'))->firstWhere('month', now()->format('Y-m'));
        $this->assertEquals(10500, $thisMonth['income']);
        $this->assertEquals(3000, $thisMonth['expenses']);
        $this->assertEquals(7500, $thisMonth['net']);
    }

    public function test_transactions_list_filters_and_exports(): void
    {
        $this->subscriptionPayment(SubscriptionPayment::STATUS_APPROVED, 2500, now());
        $this->promotion(Promotion::STATUS_APPROVED, Promotion::KIND_PAID, 8000, now());
        $owner = SystemAdmin::factory()->owner()->create();
        PlatformExpense::create(['expense_number' => 'PEX-TEST0001', 'expense_date' => now()->toDateString(), 'category' => 'marketing', 'paid_to' => 'Meta Ads', 'amount' => 1200]);

        $this->as($owner)->getJson('/api/platform/accounts/transactions')->assertOk()->assertJsonPath('record.total', 3);
        $this->as($owner)->getJson('/api/platform/accounts/transactions?source=income')->assertOk()->assertJsonPath('record.total', 2);
        $this->as($owner)->getJson('/api/platform/accounts/transactions?source=expense')->assertOk()
            ->assertJsonPath('record.total', 1)->assertJsonPath('record.data.0.reference', 'PEX-TEST0001');
        $this->as($owner)->getJson('/api/platform/accounts/transactions?search=Lanka')->assertOk()->assertJsonPath('record.total', 2);
        $this->as($owner)->getJson("/api/platform/accounts/transactions?shop_id={$this->shop->id}")->assertOk()->assertJsonPath('record.total', 2);
        $this->as($owner)->getJson('/api/platform/accounts/transactions?from=' . now()->subYears(3)->toDateString() . '&to=' . now()->subYears(2)->toDateString())
            ->assertOk()->assertJsonPath('record.total', 0);

        $csv = $this->as($owner)->get('/api/platform/accounts/transactions/export')->assertOk()->getContent();
        $this->assertStringContainsString('Money in', $csv);
        $this->assertStringContainsString('PEX-TEST0001', $csv);
        $this->assertStringContainsString('Lanka Rides', $csv);
    }

    public function test_the_owner_records_edits_and_deletes_an_expense(): void
    {
        $owner = SystemAdmin::factory()->owner()->create();

        $this->as($owner)->postJson('/api/platform/accounts/expenses', ['category' => 'nonsense', 'amount' => 0])
            ->assertUnprocessable()->assertJsonValidationErrors(['expense_date', 'category', 'amount']);

        $id = $this->as($owner)->postJson('/api/platform/accounts/expenses', [
            'expense_date' => now()->toDateString(), 'category' => 'salaries', 'paid_to' => 'Support staff', 'amount' => 45000, 'payment_method' => 'bank_transfer',
        ])->assertCreated()->json('data.id');

        $this->assertDatabaseHas('platform_expenses', ['id' => $id, 'created_by' => $owner->id, 'amount' => 45000]);
        $this->assertTrue(AuditLog::where('action', 'create')->where('form', 'PlatformExpense')->where('record_id', $id)->exists());

        $this->as($owner)->putJson("/api/platform/accounts/expenses/{$id}", [
            'expense_date' => now()->toDateString(), 'category' => 'salaries', 'amount' => 50000,
        ])->assertOk();
        $this->assertDatabaseHas('platform_expenses', ['id' => $id, 'amount' => 50000]);

        $this->as($owner)->getJson('/api/platform/accounts/expenses?category=salaries')->assertOk()->assertJsonPath('record.total', 1);

        $this->as($owner)->deleteJson("/api/platform/accounts/expenses/{$id}")->assertOk();
        $this->assertSoftDeleted('platform_expenses', ['id' => $id]);
        $this->as($owner)->getJson('/api/platform/accounts/summary')->assertOk()->assertJsonPath('data.expenses.count', 0);
    }
}
