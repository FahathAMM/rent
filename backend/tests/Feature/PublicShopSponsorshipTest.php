<?php

namespace Tests\Feature;

use App\Models\Promotion;
use App\Models\RentalShop;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** The public Shops page lists sponsored shops first (PublicShopRepo::searchQuery). */
class PublicShopSponsorshipTest extends TestCase
{
    use RefreshDatabase;

    private function sponsor(RentalShop $shop, int $daysLeft = 7): void
    {
        Promotion::create([
            'reference_no' => 'PRM-T-' . $shop->id, 'shop_id' => $shop->id, 'type' => Promotion::TYPE_SPONSORED,
            'city' => $shop->city, 'days' => 7, 'amount' => 0, 'kind' => Promotion::KIND_GRANTED, 'status' => Promotion::STATUS_APPROVED,
            'starts_at' => now()->subDay(), 'ends_at' => now()->addDays($daysLeft),
        ]);
    }

    private function names(array $query = []): array
    {
        return collect($this->getJson('/api/public/shops?' . http_build_query($query))->assertOk()->json('data'))->pluck('name')->all();
    }

    public function test_sponsored_shops_come_first_with_and_without_a_city_filter(): void
    {
        $top = RentalShop::factory()->create(['name' => 'Top Rated', 'city' => 'Kandy', 'rating_avg' => 5]);
        $sponsor = RentalShop::factory()->create(['name' => 'Sponsor', 'city' => 'Kandy', 'rating_avg' => 1]);
        $elsewhere = RentalShop::factory()->create(['name' => 'Colombo Shop', 'city' => 'Colombo', 'rating_avg' => 3]);
        $this->sponsor($sponsor);

        $this->assertSame(['Sponsor', 'Top Rated', 'Colombo Shop'], $this->names());
        $this->assertSame(['Sponsor', 'Top Rated'], $this->names(['city' => 'Kandy']));
        $this->assertSame(['Colombo Shop'], $this->names(['city' => 'Colombo']));
        $this->assertSame(['Sponsor', 'Colombo Shop', 'Top Rated'], $this->names(['sort' => 'name'])); // on top in any sort, rest A–Z

        $flags = collect($this->getJson('/api/public/shops')->json('data'))->pluck('is_sponsored', 'name');
        $this->assertTrue($flags['Sponsor']);
        $this->assertFalse($flags['Top Rated']);
    }

    public function test_an_ended_sponsorship_no_longer_counts(): void
    {
        $top = RentalShop::factory()->create(['name' => 'Top Rated', 'city' => 'Kandy', 'rating_avg' => 5]);
        $sponsor = RentalShop::factory()->create(['name' => 'Sponsor', 'city' => 'Kandy', 'rating_avg' => 1]);
        $this->sponsor($sponsor, daysLeft: -1);

        $this->assertSame(['Top Rated', 'Sponsor'], $this->names());
    }
}
