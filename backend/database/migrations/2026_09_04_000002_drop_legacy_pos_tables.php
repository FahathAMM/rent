<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

/**
 * Drops schema left over from the pre-Administration-only scope (product
 * catalogue, customers, sales, suppliers/purchases, stock). None of these
 * tables have a corresponding model/controller in the app anymore.
 */
return new class extends Migration
{
    private const TABLES = [
        'attribute_values', 'attributes', 'brands', 'categories', 'customers',
        'offer_products', 'offers', 'product_attributes', 'product_media',
        'product_seo', 'product_specifications', 'product_tag',
        'product_variant_values', 'product_variants', 'products',
        'purchase_items', 'purchase_payments', 'purchases',
        'sale_items', 'sale_return_items', 'sale_returns', 'sales',
        'stock_adjustments', 'stock_movements',
        'supplier_contacts', 'supplier_ledger_entries',
        'supplier_return_items', 'supplier_returns', 'suppliers', 'tags',
    ];

    public function up(): void
    {
        Schema::disableForeignKeyConstraints();
        foreach (self::TABLES as $table) {
            Schema::dropIfExists($table);
        }
        Schema::enableForeignKeyConstraints();
    }

    public function down(): void
    {
        // Irreversible — the original table definitions no longer exist
        // anywhere in the migration history to recreate them from.
    }
};
