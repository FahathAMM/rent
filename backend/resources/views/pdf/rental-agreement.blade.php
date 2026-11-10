@php
    // $mpdf: drawn by mPDF (Tamil) — see App\Support\PdfDocument. Labels go through __() (lang/ta.json).
    $mpdf = $mpdf ?? false;
    $loc = app()->getLocale();
    $brand = \App\Models\PlatformDetail::current()?->name ?: config('app.name');
    $cur = $pricing?->currency ?? 'LKR';
    $money = fn ($v) => $cur . ' ' . number_format((float) $v, 2);
    // Month names in the document's language; the clock stays 12-hour AM/PM.
    $day = fn ($d) => $d ? $d->copy()->locale($loc)->translatedFormat('d M Y') : '—';
    $when = fn ($d) => $d ? $day($d) . ', ' . $d->format('h:i A') : '—';
    $days = trans_choice(':count day|:count days', (int) $booking->rental_days);
    $pickup = $booking->pickupLocation;
    $return = $booking->returnLocation;
    $place = fn ($l) => $l ? implode(', ', array_filter([$l->name, $l->address, $l->city])) : __('At the shop');
    $deposit = (float) ($pricing?->security_deposit ?? 0);
    $staff = $handover?->conductedBy?->name;
    $shopAddress = implode(', ', array_filter([$shop->address_line_1, $shop->address_line_2, $shop->city, $shop->district]));
    $transmissions = ['manual' => __('Manual'), 'automatic' => __('Automatic'), 'semi_automatic' => __('Semi-automatic'), 'cvt' => 'CVT'];
    $fuels = ['petrol' => __('Petrol'), 'diesel' => __('Diesel'), 'hybrid' => __('Hybrid'), 'electric' => __('Electric'), 'lpg' => 'LPG'];
    $fuelLevels = ['empty' => __('Empty'), 'quarter' => __('Quarter'), 'half' => __('Half'), 'three_quarter' => __('Three quarter'), 'full' => __('Full')];
    $fuel = $handover?->fuel_level !== null ? ($fuelLevels[$handover->fuel_level] ?? ucwords(str_replace('_', ' ', (string) $handover->fuel_level))) : null;
    $footerText = __(':shop · Rental agreement :ref · Issued :date via :brand', [
        'shop' => $shop->name, 'ref' => $booking->booking_reference, 'date' => $when(now()), 'brand' => $brand,
    ]);
@endphp
<!DOCTYPE html>
<html lang="{{ $loc }}">
<head>
<meta charset="utf-8">
<title>{{ $booking->booking_reference }}</title>
<style>
    @if ($mpdf)
    @page { margin: 36px 40px 56px; margin-footer: 18px; footer: html_docfooter; }
    @else
    @page { margin: 36px 40px 56px; }
    @endif
    body { font-family: 'DejaVu Sans', 'Helvetica', sans-serif; font-size: 9.5px; color: #1f2937; line-height: 1.45; }
    table { width: 100%; border-collapse: collapse; }
    td { vertical-align: top; }

    /* Letterhead */
    .letterhead td { vertical-align: middle; }
    .logo { max-height: 52px; max-width: 120px; }
    .shop-name { font-size: 15px; font-weight: bold; color: #0f172a; }
    .shop-meta { color: #64748b; font-size: 8.5px; margin-top: 1px; }
    .doc-title { text-align: right; font-size: 15px; font-weight: bold; color: #0f172a; letter-spacing: 1.5px; }
    .doc-sub { text-align: right; color: #64748b; font-size: 8.5px; margin-top: 2px; }
    .rule { border-top: 2.5px solid #0f172a; margin-top: 10px; }
    .rule-thin { border-top: 1px solid #cbd5e1; margin-top: 2px; }

    /* Agreement number strip */
    .strip { margin-top: 12px; background: #f1f5f9; border: 1px solid #e2e8f0; }
    .strip td { padding: 7px 10px; border-right: 1px solid #e2e8f0; }
    .k { font-size: 7.5px; text-transform: uppercase; letter-spacing: 0.6px; color: #64748b; }
    .v { font-size: 10.5px; font-weight: bold; color: #0f172a; margin-top: 1px; }
    .signed { color: #15803d; }
    .unsigned { color: #b45309; }

    /* Sections */
    .section { margin-top: 16px; }
    .section-title { font-size: 9px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.8px; color: #0f172a; padding-bottom: 4px; border-bottom: 1px solid #0f172a; margin-bottom: 6px; }
    .party { width: 49%; border: 1px solid #e2e8f0; padding: 8px 10px; }
    .party-role { font-size: 7.5px; text-transform: uppercase; letter-spacing: 0.6px; color: #64748b; }
    .party-name { font-size: 11px; font-weight: bold; color: #0f172a; margin: 1px 0 4px; }
    .grid td { padding: 3px 0; border-bottom: 1px dotted #e2e8f0; }
    .grid .label { color: #64748b; width: 34%; }
    .grid .value { font-weight: bold; color: #0f172a; }
    .charges td { padding: 5px 8px; border-bottom: 1px solid #e2e8f0; }
    .charges .amt { text-align: right; white-space: nowrap; }
    .charges .total td { background: #0f172a; color: #ffffff; font-weight: bold; font-size: 10.5px; border-bottom: 0; }
    .charges .note td { color: #64748b; font-size: 8px; border-bottom: 0; }

    /* Terms (rich text from the shop) */
    .terms { line-height: 1.55; }
    .terms p, .terms ul, .terms ol, .terms blockquote { margin: 0 0 5px; }
    .terms h2 { font-size: 11px; margin: 8px 0 3px; color: #0f172a; }
    .terms h3 { font-size: 10px; margin: 6px 0 3px; color: #0f172a; }
    .terms ul, .terms ol { padding-left: 16px; }
    .terms li { margin-bottom: 2px; }
    .terms blockquote { padding-left: 8px; border-left: 2px solid #cbd5e1; color: #475569; }
    .terms hr { border: 0; border-top: 1px solid #e2e8f0; }
    .empty { color: #94a3b8; font-style: italic; }

    /* Declaration + signatures */
    /* mPDF repeats the text of an "avoid" block when it swaps fonts mid-line (Tamil + Latin), so only DomPDF keeps it together. */
    .sigs { margin-top: 18px; page-break-inside: {{ $mpdf ? 'auto' : 'avoid' }}; }
    .declaration { padding: 8px 10px; border-left: 3px solid #0f172a; background: #f8fafc; }
    .sig { width: 46%; }
    .sig-area { height: 64px; vertical-align: bottom; }
    .sig-img { max-height: 60px; max-width: 210px; }
    .sig-line { border-top: 1px solid #0f172a; padding-top: 4px; }
    .sig-name { font-weight: bold; color: #0f172a; }
    .sig-meta { color: #64748b; font-size: 8px; }

    /* Footer on every page */
    .footer { position: fixed; bottom: -38px; left: 0; right: 0; font-size: 7.5px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 5px; }
    .footer-m td { font-size: 7.5px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 5px; }
    .pagenum:after { content: "{{ __('Page') }} " counter(page); }
    @if ($mpdf)
    /* Letter-spacing pulls Tamil vowel signs away from their letters. */
    .doc-title, .k, .section-title, .party-role { letter-spacing: 0; text-transform: none; }
    @endif
</style>
</head>
<body>

@if ($mpdf)
<htmlpagefooter name="docfooter">
    <table class="footer-m"><tr>
        <td>{{ $footerText }}</td>
        <td style="text-align: right; width: 20%;">{{ __('Page') }} {PAGENO}</td>
    </tr></table>
</htmlpagefooter>
@else
<div class="footer">
    <table><tr>
        <td>{{ $footerText }}</td>
        <td style="text-align: right; width: 20%;"><span class="pagenum"></span></td>
    </tr></table>
</div>
@endif

{{-- Letterhead --}}
<table class="letterhead">
    <tr>
        @if ($logo)
            <td style="width: 70px; padding-right: 10px;"><img class="logo" src="{{ $logo }}" alt=""></td>
        @endif
        <td>
            <div class="shop-name">{{ $shop->name }}</div>
            @if ($shopAddress)<div class="shop-meta">{{ $shopAddress }}</div>@endif
            <div class="shop-meta">{{ implode('  ·  ', array_filter([$shop->phone, $shop->email])) }}</div>
            @if ($shop->business_registration_no)<div class="shop-meta">{{ __('Business reg. no.') }} {{ $shop->business_registration_no }}</div>@endif
        </td>
        <td style="width: 42%;">
            <div class="doc-title">{{ __('RENTAL AGREEMENT') }}</div>
            <div class="doc-sub">{{ __('Vehicle hire — terms & conditions') }}</div>
        </td>
    </tr>
</table>
<div class="rule"></div>
<div class="rule-thin"></div>

{{-- Agreement number strip --}}
<table class="strip">
    <tr>
        <td style="width: 28%;"><div class="k">{{ __('Agreement no.') }}</div><div class="v">{{ $booking->booking_reference }}</div></td>
        <td style="width: 24%;"><div class="k">{{ __('Booked on') }}</div><div class="v">{{ $day($booking->created_at) }}</div></td>
        <td style="width: 24%;"><div class="k">{{ __('Rental period') }}</div><div class="v">{{ $days }}</div></td>
        <td style="border-right: 0;"><div class="k">{{ __('Status') }}</div>
            @if ($signature)
                <div class="v signed">{{ __('Signed') }}</div>
            @else
                <div class="v unsigned">{{ __('Awaiting signature') }}</div>
            @endif
        </td>
    </tr>
</table>

{{-- 1. Parties --}}
<div class="section">
    <div class="section-title">1. {{ __('The parties') }}</div>
    <table>
        <tr>
            <td class="party">
                <div class="party-role">{{ __('Owner (the "Shop")') }}</div>
                <div class="party-name">{{ $shop->name }}</div>
                <table class="grid">
                    <tr><td class="label">{{ __('Phone') }}</td><td class="value">{{ $shop->phone ?: '—' }}</td></tr>
                    <tr><td class="label">{{ __('Email') }}</td><td class="value">{{ $shop->email ?: '—' }}</td></tr>
                    <tr><td class="label">{{ __('Address') }}</td><td class="value">{{ $shopAddress ?: '—' }}</td></tr>
                </table>
            </td>
            <td style="width: 2%;"></td>
            <td class="party">
                <div class="party-role">{{ __('Renter (the "Customer")') }}</div>
                <div class="party-name">{{ $customer?->name ?? '—' }}</div>
                <table class="grid">
                    <tr><td class="label">{{ __('Phone') }}</td><td class="value">{{ $customer?->phone ?: '—' }}</td></tr>
                    <tr><td class="label">{{ __('Email') }}</td><td class="value">{{ $customer?->email ?: '—' }}</td></tr>
                    <tr><td class="label">{{ __('Address') }}</td><td class="value">{{ $customer?->address ?: '—' }}</td></tr>
                </table>
            </td>
        </tr>
    </table>
</div>

{{-- 2. Vehicle --}}
<div class="section">
    <div class="section-title">2. {{ __('The vehicle') }}</div>
    <table>
        <tr>
            <td style="width: 49%;">
                <table class="grid">
                    <tr><td class="label">{{ __('Vehicle') }}</td><td class="value">{{ $vehicle?->title ?? '—' }}</td></tr>
                    <tr><td class="label">{{ __('Make / model') }}</td><td class="value">{{ trim(($vehicle?->make ?? '') . ' ' . ($vehicle?->model ?? '')) ?: '—' }}{{ $vehicle?->year ? ' (' . $vehicle->year . ')' : '' }}</td></tr>
                    <tr><td class="label">{{ __('Registration') }}</td><td class="value">{{ $vehicle?->registration_number ?: '—' }}</td></tr>
                </table>
            </td>
            <td style="width: 2%;"></td>
            <td style="width: 49%;">
                <table class="grid">
                    <tr><td class="label">{{ __('Gear / fuel') }}</td><td class="value">{{ $vehicle?->transmission ? ($transmissions[$vehicle->transmission] ?? ucfirst($vehicle->transmission)) : '—' }} · {{ $vehicle?->fuel_type ? ($fuels[$vehicle->fuel_type] ?? ucfirst($vehicle->fuel_type)) : '—' }}</td></tr>
                    <tr><td class="label">{{ __('Odometer out') }}</td><td class="value">{{ $handover?->odometer_reading !== null ? number_format((float) $handover->odometer_reading) . ' km' : '—' }}</td></tr>
                    <tr><td class="label">{{ __('Fuel out') }}</td><td class="value">{{ $fuel ?? '—' }}</td></tr>
                </table>
            </td>
        </tr>
    </table>
</div>

{{-- 3. Period and charges --}}
<div class="section">
    <div class="section-title">3. {{ __('Rental period & charges') }}</div>
    <table>
        <tr>
            <td style="width: 49%;">
                <table class="grid">
                    <tr><td class="label">{{ __('Pickup') }}</td><td class="value">{{ $when($booking->pickup_at) }}</td></tr>
                    <tr><td class="label">{{ __('From') }}</td><td class="value">{{ $place($pickup) }}</td></tr>
                    <tr><td class="label">{{ __('Return') }}</td><td class="value">{{ $when($booking->return_at) }}</td></tr>
                    <tr><td class="label">{{ __('To') }}</td><td class="value">{{ $place($return ?? $pickup) }}</td></tr>
                </table>
            </td>
            <td style="width: 2%;"></td>
            <td style="width: 49%;">
                <table class="charges">
                    <tr><td>{{ __('Rental charge (:days)', ['days' => $days]) }}</td><td class="amt">{{ $money($pricing?->subtotal) }}</td></tr>
                    @if ($deposit > 0)
                        <tr><td>{{ __('Refundable security deposit') }}</td><td class="amt">{{ $money($deposit) }}</td></tr>
                    @endif
                    <tr class="total"><td>{{ __('Total payable') }}</td><td class="amt">{{ $money($pricing?->total_payable) }}</td></tr>
                    @if ($deposit > 0)
                        <tr class="note"><td colspan="2">{{ __('The deposit is returned at the end of the rental, less any deductions under the terms below.') }}</td></tr>
                    @endif
                </table>
            </td>
        </tr>
    </table>
</div>

{{-- 4. Terms --}}
<div class="section">
    <div class="section-title">4. {{ __('Terms & conditions') }}</div>
    @if ($terms)
        {{-- Cleaned to plain formatting tags when the shop saves them (RentalAgreementService::sanitize). Written by the shop, in its own language. --}}
        <div class="terms">{!! $terms !!}</div>
    @else
        <div class="empty">{{ __(':shop has not added terms & conditions.', ['shop' => $shop->name]) }}</div>
    @endif
</div>

{{-- 5. Declaration and signatures --}}
<div class="sigs">
    <div class="section-title">5. {{ __('Declaration & signatures') }}</div>
    <div class="declaration">
        {!! __('I, :name, confirm that I have read and understood the terms & conditions above, that I agree to them, and that I have received the vehicle described in section 2 in the condition recorded at handover.', [
            'name' => '<strong>' . e($customer?->name ?? __('the Renter')) . '</strong>',
        ]) !!}
    </div>

    <table style="margin-top: 14px;">
        <tr>
            <td class="sig" style="width: 46%;">
                <table><tr><td class="sig-area">
                    @if ($signature)<img class="sig-img" src="{{ $signature }}" alt="{{ __('Customer signature') }}">@endif
                </td></tr></table>
                <div class="sig-line">
                    <div class="sig-name">{{ $customer?->name ?? __('Renter') }}</div>
                    <div class="sig-meta">{{ __('Renter') }} · {{ $signature ? __('Signed electronically :date', ['date' => $when($signedAt)]) : __('Signature & date') }}</div>
                </div>
            </td>
            <td style="width: 8%;"></td>
            <td class="sig" style="width: 46%;">
                <table><tr><td class="sig-area"></td></tr></table>
                <div class="sig-line">
                    <div class="sig-name">{{ $staff ?: __('For :shop', ['shop' => $shop->name]) }}</div>
                    <div class="sig-meta">{{ __('On behalf of :shop', ['shop' => $shop->name]) }}{{ $handover?->conducted_at ? ' · ' . __('Handover :date', ['date' => $when($handover->conducted_at)]) : ' · ' . __('Signature & date') }}</div>
                </div>
            </td>
        </tr>
    </table>

    @if ($signature)
        <div class="sig-meta" style="margin-top: 10px;">
            {{ __('The renter signed on screen at the handover of the vehicle. The terms above are the exact version they agreed to; later changes by the shop do not apply to this agreement.') }}
        </div>
    @endif
</div>

</body>
</html>
