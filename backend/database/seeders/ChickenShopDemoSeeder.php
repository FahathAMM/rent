<?php

namespace Database\Seeders;

use App\Models\Administration\User;
use App\Models\Company;
use App\Models\CompanySetting;
use App\Models\Expense;
use App\Models\ExpenseCategory;
use App\Models\Customer;
use App\Models\Item;
use App\Models\Purchase;
use App\Models\Sale;
use App\Models\Unit;
use App\Models\Vendor;
use App\Support\NumberGenerator;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Role;

/**
 * A single demo tenant — "Golden Chicken Trading" — with a realistic
 * catalog, vendors, purchases and expenses so the Purchasing/Expenses
 * modules have real data to click through immediately after a fresh
 * `php artisan migrate`.
 *
 * Deliberately NOT called for production deploys — DatabaseSeeder only
 * calls this outside app()->environment('production').
 */
class ChickenShopDemoSeeder extends Seeder
{
    private Company $company;
    private int $ownerId;

    /** @var array<string, Vendor> */
    private array $vendors = [];
    /** @var array<string, Customer> */
    private array $customers = [];
    /** @var array<string, Unit> */
    private array $units = [];
    /** @var array<string, Item> */
    private array $items = [];
    /** @var array<string, ExpenseCategory> */
    private array $categories = [];

    public function run(): void
    {
        $this->resetCompany();

        $this->company = Company::create([
            'name'           => 'Golden Chicken Trading',
            'legal_name'     => 'Golden Chicken Trading LLC',
            'email'          => 'info@goldenchicken-demo.com',
            'phone'          => '+1-555-0142',
            'address_line_1' => '48 Poultry Market Road',
            'city'           => 'Riverside',
            'country'        => 'United States',
            'currency'       => 'USD',
            'timezone'       => 'America/New_York',
            'status'         => 'active',
        ]);
        CompanySetting::firstOrCreate(['company_id' => $this->company->id]);

        $owner = $this->companyUser('owner@chickenshop.com', 'Amara Osei', 'owner');
        $this->companyUser('manager@chickenshop.com', 'Malik Rahman', 'admin');
        $this->companyUser('demo@chickenshop.com', 'Demo Account', 'owner');

        // Cross-tenant super-admin login for local/demo use — bypasses
        // CompanyScope entirely (see Tenant::isPlatformAdmin()), so this one
        // account can see every company on the platform, not just this one.
        $this->companyUser('fahath@demo.com', 'Fahath', 'super-admin', 'Fahath@123');

        $this->ownerId = $owner->id;

        $this->seedVendors();
        $this->seedCustomers();
        $this->seedUnits();
        $this->seedItems();
        $this->seedExpenseCategories();
        $this->seedPurchases();
        $this->seedSales();
        $this->seedExpenses();
    }

    // ── Tenant/company helpers ──────────────────────────────────────────

    /**
     * Wipes the demo company and everything under it, so re-seeding always
     * starts from a clean slate. Query builder deletes (not Eloquent), most-
     * dependent tables first — purchase_items has no company_id of its own,
     * so it's deleted via its parent purchases' ids.
     */
    private function resetCompany(): void
    {
        $company = DB::table('companies')->where('name', 'Golden Chicken Trading')->first();
        if (!$company) {
            return;
        }

        $id = $company->id;

        DB::table('purchase_items')->whereIn('purchase_id', DB::table('purchases')->where('company_id', $id)->pluck('id'))->delete();
        DB::table('sale_items')->whereIn('sale_id', DB::table('sales')->where('company_id', $id)->pluck('id'))->delete();

        foreach (['expenses', 'purchases', 'sales', 'items', 'units', 'expense_categories', 'vendors', 'customers', 'attachments', 'audit_logs', 'users'] as $table) {
            DB::table($table)->where('company_id', $id)->delete();
        }

        DB::table('company_settings')->where('company_id', $id)->delete();
        DB::table('companies')->where('id', $id)->delete();
    }

    private function companyUser(string $email, string $name, string $role, string $password = 'password'): User
    {
        $user = User::create([
            'company_id' => $this->company->id,
            'name'       => $name,
            'email'      => $email,
            'password'   => Hash::make($password),
            'is_active'  => true,
        ]);
        $user->syncRoles([Role::findByName($role, 'web')]);

        return $user;
    }

    // ── Reference data ──────────────────────────────────────────────────

    private function seedVendors(): void
    {
        $rows = [
            'sunrise'   => ['Sunrise Poultry Farm', 'Daniel Osei', 'sales@sunrisepoultry-demo.com', '+1-555-0110', '12 Farm Route, Riverside'],
            'goldfeed'  => ['Golden Feed Mills', 'Priya Nair', 'orders@goldfeedmills-demo.com', '+1-555-0121', '7 Mill Street, Riverside'],
            'freshpack' => ['Freshpack Supplies', 'Carlos Mendes', 'accounts@freshpack-demo.com', '+1-555-0133', '25 Industrial Ave, Riverside'],
            'cityice'   => ['City Ice & Cold Storage', 'Hana Lee', 'billing@cityice-demo.com', '+1-555-0147', '3 Cold Storage Way, Riverside'],
        ];

        foreach ($rows as $key => [$name, $contact, $email, $phone, $address]) {
            $this->vendors[$key] = Vendor::create([
                'company_id'     => $this->company->id,
                'name'           => $name,
                'contact_person' => $contact,
                'email'          => $email,
                'phone'          => $phone,
                'address'        => $address,
            ]);
        }
    }

    private function seedCustomers(): void
    {
        $rows = [
            // key => [name, phone, creditTermsDays]
            'riverside_grill' => ['Riverside Grill', '+1-555-0199', 15],
            'sunset_diner'    => ['Sunset Diner', '+1-555-0188', 7],
        ];

        foreach ($rows as $key => [$name, $phone, $creditTermsDays]) {
            $this->customers[$key] = Customer::create([
                'company_id'         => $this->company->id,
                'name'               => $name,
                'phone'              => $phone,
                'credit_terms_days'  => $creditTermsDays,
            ]);
        }
    }

    private function seedUnits(): void
    {
        $rows = [
            'kg'    => ['Kilogram', 'kg'],
            'g'     => ['Gram', 'g'],
            'litre' => ['Litre', 'L'],
            'box'   => ['Box', 'box'],
            'bag'   => ['Bag', 'bag'],
            'dozen' => ['Dozen', 'dz'],
            'pcs'   => ['Pieces', 'pcs'],
        ];

        foreach ($rows as $key => [$name, $shortName]) {
            $this->units[$key] = Unit::create([
                'company_id' => $this->company->id,
                'name'       => $name,
                'short_name' => $shortName,
            ]);
        }
    }

    private function seedItems(): void
    {
        $rows = [
            // key => [name, category, unit key, purchase_price, selling_price, tax_rate]
            'live_chicken'    => ['Live Chicken', 'Poultry', 'kg', 8.50, 12.00, 0],
            'dressed_chicken' => ['Dressed Chicken (Whole)', 'Poultry', 'kg', 10.00, 14.50, 0],
            'breast'          => ['Chicken Breast', 'Poultry Cuts', 'kg', 14.00, 19.00, 0],
            'thigh'           => ['Chicken Thigh', 'Poultry Cuts', 'kg', 11.00, 15.50, 0],
            'wings'           => ['Chicken Wings', 'Poultry Cuts', 'kg', 9.50, 13.50, 0],
            'feet'            => ['Chicken Feet', 'Poultry Cuts', 'kg', 3.00, 5.00, 0],
            'eggs'            => ['Eggs (Tray of 30)', 'Eggs', 'box', 9.00, 12.50, 0],
            'feed'            => ['Poultry Feed', 'Supplies', 'bag', 45.00, null, 0],
            'bags'            => ['Packaging Bags', 'Supplies', 'pcs', 0.15, null, 0],
            'ice'             => ['Ice Block', 'Supplies', 'pcs', 5.00, null, 0],
        ];

        foreach ($rows as $key => [$name, $category, $unitKey, $purchasePrice, $sellingPrice, $taxRate]) {
            $this->items[$key] = Item::create([
                'company_id'     => $this->company->id,
                'name'           => $name,
                'category'       => $category,
                'unit_id'        => $this->units[$unitKey]->id,
                'purchase_price' => $purchasePrice,
                'selling_price'  => $sellingPrice,
                'tax_rate'       => $taxRate,
                'is_active'      => true,
            ]);
        }
    }

    private function seedExpenseCategories(): void
    {
        foreach (['Rent', 'Electricity & Water', 'Fuel & Transport', 'Salaries & Wages', 'Equipment Maintenance', 'Miscellaneous'] as $name) {
            $this->categories[$name] = ExpenseCategory::create([
                'company_id' => $this->company->id,
                'name'       => $name,
                'is_active'  => true,
            ]);
        }
    }

    // ── Purchases ────────────────────────────────────────────────────────

    private function seedPurchases(): void
    {
        $this->purchase('sunrise', now()->subDays(18), 'received', 1, [
            ['live_chicken', 120, 8.50],
            ['dressed_chicken', 40, 10.00],
        ]);

        $this->purchase('goldfeed', now()->subDays(15), 'received', 1, [
            ['feed', 20, 45.00],
        ]);

        $this->purchase('freshpack', now()->subDays(12), 'received', 0.5, [
            ['bags', 2000, 0.15],
        ]);

        $this->purchase('cityice', now()->subDays(10), 'received', 0, [
            ['ice', 60, 5.00],
        ]);

        $this->purchase('sunrise', now()->subDays(6), 'received', 1, [
            ['live_chicken', 150, 8.50],
            ['dressed_chicken', 50, 10.00],
            ['wings', 30, 9.50],
        ]);

        $this->purchase('goldfeed', now()->subDays(3), 'pending', 0, [
            ['feed', 25, 45.00],
        ]);
    }

    /**
     * @param array<int, array{0: string, 1: float, 2: float}> $lines [itemKey, quantity, unitPrice]
     * @param float $paidFraction 1 = fully paid, 0.5 = half paid, 0 = unpaid
     */
    private function purchase(string $vendorKey, $date, string $status, float $paidFraction, array $lines): void
    {
        $lineRows = array_map(function ($line) {
            [$itemKey, $qty, $price] = $line;
            $item = $this->items[$itemKey];
            $subtotal = round($qty * $price, 2);

            return [
                'item_id'     => $item->id,
                'description' => $item->name,
                'quantity'    => $qty,
                'unit_price'  => $price,
                'tax_rate'    => 0,
                'subtotal'    => $subtotal,
                'total'       => $subtotal,
            ];
        }, $lines);

        $total = round(array_sum(array_column($lineRows, 'total')), 2);
        $paid = round($total * $paidFraction, 2);

        $purchase = Purchase::create([
            'company_id'      => $this->company->id,
            'purchase_number' => NumberGenerator::next($this->company->id, 'purchase'),
            'vendor_id'       => $this->vendors[$vendorKey]->id,
            'purchase_date'   => $date,
            'subtotal'        => $total,
            'discount_amount' => 0,
            'tax_amount'      => 0,
            'total'           => $total,
            'paid_amount'     => $paid,
            'balance_amount'  => round($total - $paid, 2),
            'status'          => $status,
            'created_by'      => $this->ownerId,
        ]);

        foreach ($lineRows as $sortOrder => $row) {
            $purchase->items()->create($row + ['sort_order' => $sortOrder]);
        }
    }

    // ── Sales ────────────────────────────────────────────────────────────

    private function seedSales(): void
    {
        // Walk-in counter sales — fully paid on the spot.
        $this->sale(null, 'Walk-in Customer', now()->subDays(5), 1, [
            ['breast', 3, 19.00],
            ['thigh', 2, 15.50],
        ]);

        $this->sale(null, null, now()->subDays(4), 1, [
            ['dressed_chicken', 2, 14.50],
            ['eggs', 1, 12.50],
        ]);

        $this->sale(null, 'Walk-in Customer', now()->subDays(2), 1, [
            ['wings', 4, 13.50],
        ]);

        // Credit sales to regular business customers — partially/unpaid.
        $this->sale('riverside_grill', null, now()->subDays(6), 0.5, [
            ['breast', 15, 19.00],
            ['thigh', 10, 15.50],
        ]);

        $this->sale('sunset_diner', null, now()->subDays(3), 0, [
            ['dressed_chicken', 8, 14.50],
            ['wings', 6, 13.50],
        ]);

        $this->sale('riverside_grill', null, now()->subDays(1), 1, [
            ['breast', 10, 19.00],
        ]);
    }

    /**
     * @param string|null $customerKey null = walk-in (no Customer record)
     * @param array<int, array{0: string, 1: float, 2: float}> $lines [itemKey, quantity, unitPrice]
     * @param float $paidFraction 1 = fully paid, 0.5 = half paid, 0 = unpaid
     */
    private function sale(?string $customerKey, ?string $walkInName, $date, float $paidFraction, array $lines): void
    {
        $lineRows = array_map(function ($line) {
            [$itemKey, $qty, $price] = $line;
            $item = $this->items[$itemKey];
            $subtotal = round($qty * $price, 2);

            return [
                'item_id'     => $item->id,
                'description' => $item->name,
                'quantity'    => $qty,
                'unit_price'  => $price,
                'tax_rate'    => 0,
                'subtotal'    => $subtotal,
                'total'       => $subtotal,
            ];
        }, $lines);

        $total = round(array_sum(array_column($lineRows, 'total')), 2);
        $paid = round($total * $paidFraction, 2);

        $sale = Sale::create([
            'company_id'      => $this->company->id,
            'sale_number'     => NumberGenerator::next($this->company->id, 'invoice'),
            'customer_id'     => $customerKey ? $this->customers[$customerKey]->id : null,
            'walk_in_name'    => $customerKey ? null : $walkInName,
            'sale_date'       => $date,
            'subtotal'        => $total,
            'discount_amount' => 0,
            'tax_amount'      => 0,
            'total'           => $total,
            'paid_amount'     => $paid,
            'balance_amount'  => round($total - $paid, 2),
            'status'          => 'completed',
            'created_by'      => $this->ownerId,
        ]);

        foreach ($lineRows as $sortOrder => $row) {
            $sale->items()->create($row + ['sort_order' => $sortOrder]);
        }
    }

    // ── Expenses ─────────────────────────────────────────────────────────

    private function seedExpenses(): void
    {
        $rows = [
            // [category, vendorName, description, daysAgo, amount, method]
            ['Rent', 'Riverside Property Management', 'Monthly shop rent', 25, 1200.00, 'bank_transfer'],
            ['Electricity & Water', 'Riverside Utilities', 'Electricity bill', 20, 185.40, 'bank_transfer'],
            ['Electricity & Water', 'Riverside Utilities', 'Water bill', 20, 62.10, 'bank_transfer'],
            ['Fuel & Transport', 'City Gas Station', 'Delivery van fuel', 14, 74.50, 'cash'],
            ['Salaries & Wages', null, 'Staff wages — first half of month', 12, 950.00, 'cash'],
            ['Equipment Maintenance', 'ColdFix Repairs', 'Walk-in freezer repair', 8, 220.00, 'card'],
            ['Fuel & Transport', 'City Gas Station', 'Delivery van fuel', 5, 68.00, 'cash'],
            ['Miscellaneous', null, 'Cleaning supplies', 3, 34.75, 'cash'],
        ];

        foreach ($rows as [$categoryName, $vendorName, $description, $daysAgo, $amount, $method]) {
            Expense::create([
                'company_id'           => $this->company->id,
                'expense_number'       => NumberGenerator::next($this->company->id, 'expense'),
                'expense_category_id'  => $this->categories[$categoryName]->id,
                'expense_date'         => now()->subDays($daysAgo),
                'vendor_name'          => $vendorName,
                'description'          => $description,
                'subtotal'             => $amount,
                'tax_rate'             => 0,
                'tax_amount'           => 0,
                'total'                => $amount,
                'payment_method'       => $method,
                'created_by'           => $this->ownerId,
            ]);
        }
    }
}
