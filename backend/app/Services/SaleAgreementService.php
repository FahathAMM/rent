<?php

namespace App\Services;

use App\Models\ShopSettings;
use App\Models\VehicleSale;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

/**
 * The shop's sale terms and the buyer's signature on them — the same shape as
 * RentalAgreementService, which also supplies the cleaning and PNG checks.
 * The signed terms are copied onto the sale, so later edits never change it.
 */
class SaleAgreementService
{
    public function __construct(private RentalAgreementService $rental) {}

    /** The shop's current sale terms as HTML, or null when it has none. */
    public function termsFor(int $shopId): ?string
    {
        return $this->rental->toHtml(ShopSettings::where('shop_id', $shopId)->value('sale_terms'));
    }

    /** Clean the editor's HTML and save it as the shop's sale terms. */
    public function saveTerms(int $shopId, ?string $html): string
    {
        $settings = ShopSettings::where('shop_id', $shopId)->first() ?? ShopSettings::createFor($shopId);
        $settings->update(['sale_terms' => $this->rental->sanitize($html)]);

        return (string) $settings->sale_terms;
    }

    /**
     * Check the terms + signature and store the signature; returns the fields
     * to save on the sale. When the shop has terms the buyer must agree and
     * sign; without terms a signature is optional.
     *
     * @return array{terms_snapshot?: string, buyer_signature_path?: string, terms_accepted_at?: \Illuminate\Support\Carbon}
     */
    public function capture(int $shopId, string $reference, ?string $signatureDataUrl, bool $termsAccepted): array
    {
        $terms = $this->termsFor($shopId);

        if ($terms && !$termsAccepted) {
            throw ValidationException::withMessages(['terms_accepted' => ['The buyer must agree to the sale terms.']]);
        }
        if ($terms && blank($signatureDataUrl)) {
            throw ValidationException::withMessages(['customer_signature' => ['The buyer must sign the sale terms.']]);
        }
        if (blank($signatureDataUrl)) {
            return [];
        }

        $png = $this->rental->decodePng($signatureDataUrl);
        $path = "signatures/{$shopId}/{$reference}-sale.png";
        Storage::disk(RentalAgreementService::DISK)->put($path, $png);

        return array_filter([
            'buyer_signature_path' => $path,
            'terms_snapshot' => $terms,
            'terms_accepted_at' => $terms ? now() : null,
        ], fn ($v) => $v !== null);
    }

    public function pdf(VehicleSale $sale)
    {
        $disk = Storage::disk(RentalAgreementService::DISK);
        $path = $sale->buyer_signature_path;

        return Pdf::loadView('pdf.sale-agreement', [
            'logo' => $this->rental->logoDataUri($sale->shop),
            'sale' => $sale,
            'shop' => $sale->shop,
            'vehicle' => $sale->vehicle,
            'detail' => $sale->vehicle?->saleDetail,
            'terms' => $this->rental->toHtml($sale->terms_snapshot),
            'signature' => $path && $disk->exists($path) ? 'data:image/png;base64,' . base64_encode($disk->get($path)) : null,
        ])->setPaper('a4');
    }
}
