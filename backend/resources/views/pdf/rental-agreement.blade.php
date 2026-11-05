@php
    $brand = \App\Models\PlatformDetail::current()?->name ?: config('app.name');
    $cur = $pricing?->currency ?? 'LKR';
    $money = fn ($v) => $cur . ' ' . number_format((float) $v, 2);
    $when = fn ($d) => $d ? $d->format('d M Y, h:i A') : '—';
    $day = fn ($d) => $d ? $d->format('d M Y') : '—';
    $days = $booking->rental_days . ' ' . \Illuminate\Support\Str::plural('day', (int) $booking->rental_days);
    $pickup = $booking->pickupLocation;
    $return = $booking->returnLocation;
    $place = fn ($l) => $l ? implode(', ', array_filter([$l->name, $l->address, $l->city])) : 'At the shop';
    $deposit = (float) ($pricing?->security_deposit ?? 0);
    $staff = $handover?->conductedBy?->name;
    $shopAddress = implode(', ', array_filter([$shop->address_line_1, $shop->address_line_2, $shop->city, $shop->district]));
    $fuel = $handover?->fuel_level !== null ? ucwords(str_replace('_', ' ', (string) $handover->fuel_level)) : null;
@endphp
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>{{ $booking->booking_reference }}</title>
<style>
    @page { margin: 36px 40px 56px; }
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
    .sigs { margin-top: 18px; page-break-inside: avoid; }
    .declaration { padding: 8px 10px; border-left: 3px solid #0f172a; background: #f8fafc; }
    .sig { width: 46%; }
    .sig-area { height: 64px; vertical-align: bottom; }
    .sig-img { max-height: 60px; max-width: 210px; }
    .sig-line { border-top: 1px solid #0f172a; padding-top: 4px; }
    .sig-name { font-weight: bold; color: #0f172a; }
    .sig-meta { color: #64748b; font-size: 8px; }

    /* Footer on every page */
    .footer { position: fixed; bottom: -38px; left: 0; right: 0; font-size: 7.5px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 5px; }
    .pagenum:after { content: "Page " counter(page); }
</style>
</head>
<body>

<div class="footer">
    <table><tr>
        <td>{{ $shop->name }} · Rental agreement {{ $booking->booking_reference }} · Issued {{ now()->format('d M Y, h:i A') }} via {{ $brand }}</td>
        <td style="text-align: right; width: 20%;"><span class="pagenum"></span></td>
    </tr></table>
</div>

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
            @if ($shop->business_registration_no)<div class="shop-meta">Business reg. no. {{ $shop->business_registration_no }}</div>@endif
        </td>
        <td style="width: 42%;">
            <div class="doc-title">RENTAL AGREEMENT</div>
            <div class="doc-sub">Vehicle hire — terms &amp; conditions</div>
        </td>
    </tr>
</table>
<div class="rule"></div>
<div class="rule-thin"></div>

{{-- Agreement number strip --}}
<table class="strip">
    <tr>
        <td style="width: 28%;"><div class="k">Agreement no.</div><div class="v">{{ $booking->booking_reference }}</div></td>
        <td style="width: 24%;"><div class="k">Booked on</div><div class="v">{{ $day($booking->created_at) }}</div></td>
        <td style="width: 24%;"><div class="k">Rental period</div><div class="v">{{ $days }}</div></td>
        <td style="border-right: 0;"><div class="k">Status</div>
            @if ($signature)
                <div class="v signed">Signed</div>
            @else
                <div class="v unsigned">Awaiting signature</div>
            @endif
        </td>
    </tr>
</table>

{{-- 1. Parties --}}
<div class="section">
    <div class="section-title">1. The parties</div>
    <table>
        <tr>
            <td class="party">
                <div class="party-role">Owner (the "Shop")</div>
                <div class="party-name">{{ $shop->name }}</div>
                <table class="grid">
                    <tr><td class="label">Phone</td><td class="value">{{ $shop->phone ?: '—' }}</td></tr>
                    <tr><td class="label">Email</td><td class="value">{{ $shop->email ?: '—' }}</td></tr>
                    <tr><td class="label">Address</td><td class="value">{{ $shopAddress ?: '—' }}</td></tr>
                </table>
            </td>
            <td style="width: 2%;"></td>
            <td class="party">
                <div class="party-role">Renter (the "Customer")</div>
                <div class="party-name">{{ $customer?->name ?? '—' }}</div>
                <table class="grid">
                    <tr><td class="label">Phone</td><td class="value">{{ $customer?->phone ?: '—' }}</td></tr>
                    <tr><td class="label">Email</td><td class="value">{{ $customer?->email ?: '—' }}</td></tr>
                    <tr><td class="label">Address</td><td class="value">{{ $customer?->address ?: '—' }}</td></tr>
                </table>
            </td>
        </tr>
    </table>
</div>

{{-- 2. Vehicle --}}
<div class="section">
    <div class="section-title">2. The vehicle</div>
    <table>
        <tr>
            <td style="width: 49%;">
                <table class="grid">
                    <tr><td class="label">Vehicle</td><td class="value">{{ $vehicle?->title ?? '—' }}</td></tr>
                    <tr><td class="label">Make / model</td><td class="value">{{ trim(($vehicle?->make ?? '') . ' ' . ($vehicle?->model ?? '')) ?: '—' }}{{ $vehicle?->year ? ' (' . $vehicle->year . ')' : '' }}</td></tr>
                    <tr><td class="label">Registration</td><td class="value">{{ $vehicle?->registration_number ?: '—' }}</td></tr>
                </table>
            </td>
            <td style="width: 2%;"></td>
            <td style="width: 49%;">
                <table class="grid">
                    <tr><td class="label">Gear / fuel</td><td class="value">{{ $vehicle?->transmission ? ucfirst($vehicle->transmission) : '—' }} · {{ $vehicle?->fuel_type ? ucfirst($vehicle->fuel_type) : '—' }}</td></tr>
                    <tr><td class="label">Odometer out</td><td class="value">{{ $handover?->odometer_reading !== null ? number_format((float) $handover->odometer_reading) . ' km' : '—' }}</td></tr>
                    <tr><td class="label">Fuel out</td><td class="value">{{ $fuel ?? '—' }}</td></tr>
                </table>
            </td>
        </tr>
    </table>
</div>

{{-- 3. Period and charges --}}
<div class="section">
    <div class="section-title">3. Rental period &amp; charges</div>
    <table>
        <tr>
            <td style="width: 49%;">
                <table class="grid">
                    <tr><td class="label">Pickup</td><td class="value">{{ $when($booking->pickup_at) }}</td></tr>
                    <tr><td class="label">From</td><td class="value">{{ $place($pickup) }}</td></tr>
                    <tr><td class="label">Return</td><td class="value">{{ $when($booking->return_at) }}</td></tr>
                    <tr><td class="label">To</td><td class="value">{{ $place($return ?? $pickup) }}</td></tr>
                </table>
            </td>
            <td style="width: 2%;"></td>
            <td style="width: 49%;">
                <table class="charges">
                    <tr><td>Rental charge ({{ $days }})</td><td class="amt">{{ $money($pricing?->subtotal) }}</td></tr>
                    @if ($deposit > 0)
                        <tr><td>Refundable security deposit</td><td class="amt">{{ $money($deposit) }}</td></tr>
                    @endif
                    <tr class="total"><td>Total payable</td><td class="amt">{{ $money($pricing?->total_payable) }}</td></tr>
                    @if ($deposit > 0)
                        <tr class="note"><td colspan="2">The deposit is returned at the end of the rental, less any deductions under the terms below.</td></tr>
                    @endif
                </table>
            </td>
        </tr>
    </table>
</div>

{{-- 4. Terms --}}
<div class="section">
    <div class="section-title">4. Terms &amp; conditions</div>
    @if ($terms)
        {{-- Cleaned to plain formatting tags when the shop saves them (RentalAgreementService::sanitize). --}}
        <div class="terms">{!! $terms !!}</div>
    @else
        <div class="empty">{{ $shop->name }} has not added terms &amp; conditions.</div>
    @endif
</div>

{{-- 5. Declaration and signatures --}}
<div class="sigs">
    <div class="section-title">5. Declaration &amp; signatures</div>
    <div class="declaration">
        I, <strong>{{ $customer?->name ?? 'the Renter' }}</strong>, confirm that I have read and understood the terms &amp; conditions above,
        that I agree to them, and that I have received the vehicle described in section 2 in the condition recorded at handover.
    </div>

    <table style="margin-top: 14px;">
        <tr>
            <td class="sig">
                <table><tr><td class="sig-area">
                    @if ($signature)<img class="sig-img" src="{{ $signature }}" alt="Customer signature">@endif
                </td></tr></table>
                <div class="sig-line">
                    <div class="sig-name">{{ $customer?->name ?? 'Renter' }}</div>
                    <div class="sig-meta">Renter · {{ $signature ? 'Signed electronically ' . $when($signedAt) : 'Signature & date' }}</div>
                </div>
            </td>
            <td style="width: 8%;"></td>
            <td class="sig">
                <table><tr><td class="sig-area"></td></tr></table>
                <div class="sig-line">
                    <div class="sig-name">{{ $staff ?: 'For ' . $shop->name }}</div>
                    <div class="sig-meta">On behalf of {{ $shop->name }}{{ $handover?->conducted_at ? ' · Handover ' . $when($handover->conducted_at) : ' · Signature & date' }}</div>
                </div>
            </td>
        </tr>
    </table>

    @if ($signature)
        <div class="sig-meta" style="margin-top: 10px;">
            The renter signed on screen at the handover of the vehicle. The terms above are the exact version they agreed to; later changes by the shop do not apply to this agreement.
        </div>
    @endif
</div>

</body>
</html>
