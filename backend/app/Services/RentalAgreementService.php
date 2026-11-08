<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\BookingInspection;
use App\Models\RentalShop;
use App\Models\ShopSettings;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

/**
 * A shop's own terms & conditions and the customer's signature on them.
 *
 *  - The shop writes its terms once (shop_settings.agreement_terms).
 *  - At handover the customer reads them on the shop's screen, agrees and
 *    signs with a finger. The handover inspection keeps the signature image
 *    (private disk), the exact terms text they agreed to and when — so later
 *    edits to the terms never change a signed agreement.
 *  - The rental agreement PDF prints the booking, the terms and the signature.
 */
class RentalAgreementService
{
    public const DISK = 'local';
    private const MAX_SIGNATURE_BYTES = 1_000_000;

    /** Tags the rich text editor may use. Every attribute is removed, so no links, styles or scripts survive. */
    private const ALLOWED_TAGS = '<p><br><strong><b><em><i><u><s><h2><h3><ul><ol><li><blockquote><hr>';

    /** The shop's current terms as HTML, or null when it has none. */
    public function termsFor(int $shopId): ?string
    {
        return $this->toHtml(ShopSettings::where('shop_id', $shopId)->value('agreement_terms'));
    }

    /** Clean the editor's HTML before saving: allowed tags only, no attributes. Null when it has no text. */
    public function sanitize(?string $html): ?string
    {
        $html = strip_tags((string) $html, self::ALLOWED_TAGS);
        $html = preg_replace('#<(/?)([a-z0-9]+)[^>]*>#i', '<$1$2>', $html);

        return trim(html_entity_decode(strip_tags($html))) === '' ? null : trim($html);
    }

    /** Terms saved before the rich editor were plain text — show those as paragraphs. */
    public function toHtml(?string $terms): ?string
    {
        $terms = trim((string) $terms);
        if ($terms === '') {
            return null;
        }
        if ($terms === strip_tags($terms)) {
            return '<p>' . nl2br(e($terms), false) . '</p>';
        }

        return $this->sanitize($terms);
    }

    /**
     * Check the handover's terms + signature and store the signature. Returns the
     * fields to save on the handover inspection. When the shop has terms, the
     * customer must agree and sign; without terms a signature is optional.
     *
     * @return array{customer_signature_path?: string, terms_snapshot?: string, terms_accepted_at?: \Illuminate\Support\Carbon}
     */
    public function captureAtHandover(Booking $booking, ?string $signatureDataUrl, bool $termsAccepted): array
    {
        $terms = $this->termsFor($booking->shop_id);

        if ($terms && !$termsAccepted) {
            throw ValidationException::withMessages(['terms_accepted' => ['The customer must agree to the terms & conditions.']]);
        }
        if ($terms && blank($signatureDataUrl)) {
            throw ValidationException::withMessages(['customer_signature' => ['The customer must sign the terms & conditions.']]);
        }
        if (blank($signatureDataUrl)) {
            return [];
        }

        $png = $this->decodePng($signatureDataUrl);
        $path = "signatures/{$booking->shop_id}/{$booking->booking_reference}-handover.png";
        Storage::disk(self::DISK)->put($path, $png);

        return array_filter([
            'customer_signature_path' => $path,
            'terms_snapshot' => $terms,
            'terms_accepted_at' => $terms ? now() : null,
        ], fn ($v) => $v !== null);
    }

    /** The rental agreement PDF: booking, the shop's terms (as signed, or current if not yet signed) and the signature. */
    public function pdf(Booking $booking)
    {
        $booking->loadMissing(['vehicle', 'shop', 'customer', 'pricing', 'pickupLocation', 'returnLocation']);
        $handover = BookingInspection::where('booking_id', $booking->id)->where('type', BookingInspection::TYPE_HANDOVER)->latest('id')->first();

        $signature = null;
        if ($handover?->customer_signature_path && Storage::disk(self::DISK)->exists($handover->customer_signature_path)) {
            $signature = 'data:image/png;base64,' . base64_encode(Storage::disk(self::DISK)->get($handover->customer_signature_path));
        }

        $handover?->loadMissing('conductedBy');

        return Pdf::loadView('pdf.rental-agreement', [
            'logo' => $this->logoDataUri($booking->shop),
            'booking' => $booking,
            'shop' => $booking->shop,
            'customer' => $booking->customer,
            'vehicle' => $booking->vehicle,
            'pricing' => $booking->pricing,
            'terms' => $this->toHtml($handover?->terms_snapshot) ?? $this->termsFor($booking->shop_id),
            'signature' => $signature,
            'signedAt' => $handover?->terms_accepted_at ?? ($signature ? $handover?->conducted_at : null),
            'handover' => $handover,
        ])->setPaper('a4');
    }

    /** Status for the booking pages. */
    public function status(Booking $booking): array
    {
        $handover = BookingInspection::where('booking_id', $booking->id)->where('type', BookingInspection::TYPE_HANDOVER)->latest('id')->first();

        $terms = $this->termsFor($booking->shop_id);

        return [
            // The shop's current terms — shown on screen at handover for the customer to read and sign.
            'terms' => $terms,
            'signed' => (bool) $handover?->customer_signature_path,
            'signed_at' => ($handover?->terms_accepted_at ?? ($handover?->customer_signature_path ? $handover->conducted_at : null))?->toIso8601String(),
            'has_terms' => $terms !== null || (bool) $handover?->terms_snapshot,
        ];
    }

    /** The shop logo, embedded so DomPDF never fetches a URL. */
    public function logoDataUri(?RentalShop $shop): ?string
    {
        $logoPath = $shop?->logo;
        if (!$logoPath || str_starts_with($logoPath, 'http') || !Storage::disk('public')->exists($logoPath)) {
            return null;
        }

        $mime = Storage::disk('public')->mimeType($logoPath);

        return in_array($mime, ['image/png', 'image/jpeg', 'image/gif'], true)
            ? "data:{$mime};base64," . base64_encode(Storage::disk('public')->get($logoPath))
            : null;
    }

    public function decodePng(string $dataUrl): string
    {
        if (!preg_match('#^data:image/png;base64,([A-Za-z0-9+/=]+)$#', $dataUrl, $m)) {
            throw ValidationException::withMessages(['customer_signature' => ['The signature must be a PNG image.']]);
        }
        $png = base64_decode($m[1], true);
        if ($png === false || !str_starts_with($png, "\x89PNG") || strlen($png) > self::MAX_SIGNATURE_BYTES) {
            throw ValidationException::withMessages(['customer_signature' => ['The signature image is not valid.']]);
        }

        return $png;
    }
}
