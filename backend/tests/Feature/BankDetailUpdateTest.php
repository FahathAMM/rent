<?php

namespace Tests\Feature;

use App\Models\Administration\User;
use App\Models\OwnerBankDetail;
use App\Models\RentalShop;
use Spatie\Permission\Models\Permission;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** PUT /vendor/bank-details/{id} - the stored account number is kept unless a new one is typed. */
class BankDetailUpdateTest extends TestCase
{
    use RefreshDatabase;

    private RentalShop $shop;
    private OwnerBankDetail $detail;

    protected function setUp(): void
    {
        parent::setUp();

        $owner = User::factory()->create();
        $owner->givePermissionTo(Permission::firstOrCreate(['name' => 'vendor-finance-bank_details-edit', 'guard_name' => 'web']));
        $this->shop = RentalShop::factory()->create(['owner_user_id' => $owner->id]);
        $owner->update(['shop_id' => $this->shop->id]);

        $this->detail = OwnerBankDetail::create([
            'shop_id' => $this->shop->id, 'account_holder_name' => 'A Perera', 'bank_name' => 'BOC',
            'account_number' => '1234567890', 'account_number_last4' => '7890', 'is_primary' => true,
            'verification_status' => 'verified', 'verified_at' => now(),
        ]);
    }

    private function save(array $data)
    {
        return $this->withHeader('Authorization', 'Bearer ' . $this->shop->owner->createToken('t')->plainTextToken)
            ->putJson("/api/vendor/bank-details/{$this->detail->id}", $data + ['account_holder_name' => 'A Perera', 'bank_name' => 'BOC']);
    }

    public function test_blank_account_number_keeps_the_stored_one(): void
    {
        $this->save(['branch_name' => 'Kandy', 'account_number' => ''])->assertOk()->assertJsonMissingPath('data.account_number');

        $detail = $this->detail->fresh();
        $this->assertSame('1234567890', $detail->account_number);
        $this->assertSame('Kandy', $detail->branch_name);
        $this->assertSame('unverified', $detail->verification_status, 'branch change needs re-verification');
    }

    public function test_new_account_number_updates_last4(): void
    {
        $this->save(['account_number' => '5555000011'])->assertOk()->assertJsonPath('data.account_number_last4', '0011');
        $this->assertSame('5555000011', $this->detail->fresh()->account_number);
    }

    public function test_type_only_change_keeps_verification_and_primary(): void
    {
        $this->save(['account_type' => 'savings', 'is_primary' => false])->assertOk();

        $detail = $this->detail->fresh();
        $this->assertSame('verified', $detail->verification_status);
        $this->assertTrue($detail->is_primary);
    }

    public function test_another_shops_detail_is_not_found(): void
    {
        $this->detail->update(['shop_id' => RentalShop::factory()->create()->id]);
        $this->save([])->assertNotFound();
    }
}
