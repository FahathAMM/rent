<?php

namespace Tests\Feature;

use App\Models\Company;
use App\Models\CompanySetting;
use App\Support\NumberGenerator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class NumberGeneratorTest extends TestCase
{
    use RefreshDatabase;

    public function test_generates_sequential_padded_numbers_with_year_for_invoices(): void
    {
        $company = Company::factory()->create();
        CompanySetting::factory()->for($company)->create(['invoice_prefix' => 'INV', 'next_invoice_number' => 1]);

        $year = now()->format('Y');

        $this->assertEquals("INV-{$year}-00001", NumberGenerator::next($company->id, 'invoice'));
        $this->assertEquals("INV-{$year}-00002", NumberGenerator::next($company->id, 'invoice'));
        $this->assertEquals("INV-{$year}-00003", NumberGenerator::next($company->id, 'invoice'));
    }

    public function test_branch_numbers_have_no_year_segment(): void
    {
        $company = Company::factory()->create();
        CompanySetting::factory()->for($company)->create(['branch_prefix' => 'BR', 'next_branch_number' => 1]);

        $this->assertEquals('BR-001', NumberGenerator::next($company->id, 'branch'));
        $this->assertEquals('BR-002', NumberGenerator::next($company->id, 'branch'));
    }

    public function test_each_company_has_its_own_independent_sequence(): void
    {
        $companyA = Company::factory()->create();
        $companyB = Company::factory()->create();
        CompanySetting::factory()->for($companyA)->create(['invoice_prefix' => 'INV', 'next_invoice_number' => 1]);
        CompanySetting::factory()->for($companyB)->create(['invoice_prefix' => 'INV', 'next_invoice_number' => 1]);

        $year = now()->format('Y');

        NumberGenerator::next($companyA->id, 'invoice');
        NumberGenerator::next($companyA->id, 'invoice');

        // Company B is untouched by Company A's usage — starts at 1 again.
        $this->assertEquals("INV-{$year}-00001", NumberGenerator::next($companyB->id, 'invoice'));
    }
}
