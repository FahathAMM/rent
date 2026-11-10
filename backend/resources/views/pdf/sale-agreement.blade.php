@php
    $brand = \App\Models\PlatformDetail::current()?->name ?: config('app.name');
    $cur = $detail?->currency ?? 'LKR';
    $money = fn ($v) => $cur . ' ' . number_format((float) $v, 2);
    $shopAddress = implode(', ', array_filter([$shop->address_line_1, $shop->address_line_2, $shop->city, $shop->district]));
    $label = fn ($v) => $v ? ucwords(str_replace('_', ' ', (string) $v)) : '—';
@endphp
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>{{ $sale->reference }}</title>
<style>
    @page { margin: 36px 40px 56px; }
    body { font-family: 'DejaVu Sans', 'Helvetica', sans-serif; font-size: 9.5px; color: #1f2937; line-height: 1.45; }
    table { width: 100%; border-collapse: collapse; }
    td { vertical-align: top; }
    .letterhead td { vertical-align: middle; }
    .logo { max-height: 52px; max-width: 120px; }
    .shop-name { font-size: 15px; font-weight: bold; color: #0f172a; }
    .shop-meta { color: #64748b; font-size: 8.5px; margin-top: 1px; }
    .doc-title { text-align: right; font-size: 15px; font-weight: bold; color: #0f172a; letter-spacing: 1.5px; }
    .doc-sub { text-align: right; color: #64748b; font-size: 8.5px; margin-top: 2px; }
    .rule { border-top: 2.5px solid #0f172a; margin-top: 10px; }
    .rule-thin { border-top: 1px solid #cbd5e1; margin-top: 2px; }
    .strip { margin-top: 12px; background: #f1f5f9; border: 1px solid #e2e8f0; }
    .strip td { padding: 7px 10px; border-right: 1px solid #e2e8f0; }
    .k { font-size: 7.5px; text-transform: uppercase; letter-spacing: 0.6px; color: #64748b; }
    .v { font-size: 10.5px; font-weight: bold; color: #0f172a; margin-top: 1px; }
    .signed { color: #15803d; }
    .unsigned { color: #b45309; }
    .section { margin-top: 16px; }
    .section-title { font-size: 9px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.8px; color: #0f172a; padding-bottom: 4px; border-bottom: 1px solid #0f172a; margin-bottom: 6px; }
    .party { width: 49%; border: 1px solid #e2e8f0; padding: 8px 10px; }
    .party-role { font-size: 7.5px; text-transform: uppercase; letter-spacing: 0.6px; color: #64748b; }
    .party-name { font-size: 11px; font-weight: bold; color: #0f172a; margin: 1px 0 4px; }
    .grid td { padding: 3px 0; border-bottom: 1px dotted #e2e8f0; }
    .grid .label { color: #64748b; width: 34%; }
    .grid .value { font-weight: bold; color: #0f172a; }
    .terms { line-height: 1.55; }
    .terms p, .terms ul, .terms ol, .terms blockquote { margin: 0 0 5px; }
    .terms h2 { font-size: 11px; margin: 8px 0 3px; color: #0f172a; }
    .terms h3 { font-size: 10px; margin: 6px 0 3px; color: #0f172a; }
    .terms ul, .terms ol { padding-left: 16px; }
    .terms li { margin-bottom: 2px; }
    .terms blockquote { padding-left: 8px; border-left: 2px solid #cbd5e1; color: #475569; }
    .terms hr { border: 0; border-top: 1px solid #e2e8f0; }
    .empty { color: #94a3b8; font-style: italic; }
    .sigs { margin-top: 18px; page-break-inside: avoid; }
    .sig { width: 46%; }
    .sig-area { height: 64px; vertical-align: bottom; }
    .sig-img { max-height: 60px; max-width: 210px; }
    .sig-line { border-top: 1px solid #0f172a; padding-top: 4px; }
    .sig-name { font-weight: bold; color: #0f172a; }
    .sig-meta { color: #64748b; font-size: 8px; }
    .footer { position: fixed; bottom: -38px; left: 0; right: 0; font-size: 7.5px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 5px; }
    .pagenum:after { content: "Page " counter(page); }
</style>
</head>
<body>

<div class="footer">
    <table><tr>
        <td>{{ $shop->name }} · Sale agreement {{ $sale->reference }} · Issued {{ now()->format('d M Y, h:i A') }} via {{ $brand }}</td>
        <td style="text-align: right; width: 20%;"><span class="pagenum"></span></td>
    </tr></table>
</div>

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
            <div class="doc-title">SALE AGREEMENT</div>
            <div class="doc-sub">Vehicle sale — terms &amp; conditions</div>
        </td>
    </tr>
</table>
<div class="rule"></div>
<div class="rule-thin"></div>

<table class="strip">
    <tr>
        <td style="width: 28%;"><div class="k">Agreement no.</div><div class="v">{{ $sale->reference }}</div></td>
        <td style="width: 24%;"><div class="k">Sold on</div><div class="v">{{ $sale->sold_at->format('d M Y') }}</div></td>
        <td style="width: 24%;"><div class="k">Sale price</div><div class="v">{{ $money($sale->sale_price) }}</div></td>
        <td style="border-right: 0;"><div class="k">Status</div>
            @if ($signature)
                <div class="v signed">Signed</div>
            @else
                <div class="v unsigned">Not signed</div>
            @endif
        </td>
    </tr>
</table>

<div class="section">
    <div class="section-title">1. The parties</div>
    <table>
        <tr>
            <td class="party">
                <div class="party-role">Seller (the "Shop")</div>
                <div class="party-name">{{ $shop->name }}</div>
                <table class="grid">
                    <tr><td class="label">Phone</td><td class="value">{{ $shop->phone ?: '—' }}</td></tr>
                    <tr><td class="label">Email</td><td class="value">{{ $shop->email ?: '—' }}</td></tr>
                    <tr><td class="label">Address</td><td class="value">{{ $shopAddress ?: '—' }}</td></tr>
                </table>
            </td>
            <td style="width: 2%;"></td>
            <td class="party">
                <div class="party-role">Buyer</div>
                <div class="party-name">{{ $sale->buyer_name }}</div>
                <table class="grid">
                    <tr><td class="label">NIC</td><td class="value">{{ $sale->buyer_nic }}</td></tr>
                    <tr><td class="label">Phone</td><td class="value">{{ $sale->buyer_phone }}</td></tr>
                    <tr><td class="label">Address</td><td class="value">{{ $sale->buyer_address ?: '—' }}</td></tr>
                </table>
            </td>
        </tr>
    </table>
</div>

<div class="section">
    <div class="section-title">2. The vehicle</div>
    <table>
        <tr>
            <td style="width: 49%;">
                <table class="grid">
                    <tr><td class="label">Vehicle</td><td class="value">{{ $vehicle?->title ?? '—' }}</td></tr>
                    <tr><td class="label">Make / model</td><td class="value">{{ trim(($vehicle?->make ?? '') . ' ' . ($vehicle?->model ?? '')) ?: '—' }}{{ $vehicle?->year ? ' (' . $vehicle->year . ')' : '' }}</td></tr>
                    <tr><td class="label">Registration</td><td class="value">{{ $vehicle?->registration_number ?: 'Not yet registered' }}</td></tr>
                </table>
            </td>
            <td style="width: 2%;"></td>
            <td style="width: 49%;">
                <table class="grid">
                    <tr><td class="label">Condition</td><td class="value">{{ $label($detail?->condition) }}</td></tr>
                    <tr><td class="label">Mileage</td><td class="value">{{ $detail ? number_format($detail->mileage_km) . ' km' : '—' }}</td></tr>
                    <tr><td class="label">Warranty</td><td class="value">{{ $detail?->warranty_months ? $detail->warranty_months . ' months' : 'None' }}</td></tr>
                </table>
            </td>
        </tr>
    </table>
</div>

<div class="section">
    <div class="section-title">3. Payment</div>
    <table class="grid">
        <tr><td class="label">Sale price</td><td class="value">{{ $money($sale->sale_price) }}</td></tr>
        <tr><td class="label">Paid by</td><td class="value">{{ $label($sale->payment_method) }}</td></tr>
        <tr><td class="label">Date of sale</td><td class="value">{{ $sale->sold_at->format('d M Y, h:i A') }}</td></tr>
    </table>
</div>

<div class="section">
    <div class="section-title">4. Terms &amp; conditions</div>
    @if ($terms)
        <div class="terms">{!! $terms !!}</div>
    @else
        <p class="empty">The shop had no sale terms on file for this sale.</p>
    @endif
</div>

<table class="sigs">
    <tr>
        <td class="sig">
            <div class="sig-area">
                @if ($signature)<img class="sig-img" src="{{ $signature }}" alt="">@endif
            </div>
            <div class="sig-line">
                <div class="sig-name">{{ $sale->buyer_name }}</div>
                <div class="sig-meta">Buyer{{ $sale->terms_accepted_at ? ' · agreed ' . $sale->terms_accepted_at->format('d M Y, h:i A') : '' }}</div>
            </div>
        </td>
        <td style="width: 8%;"></td>
        <td class="sig">
            <div class="sig-area"></div>
            <div class="sig-line">
                <div class="sig-name">{{ $shop->name }}</div>
                <div class="sig-meta">For the seller</div>
            </div>
        </td>
    </tr>
</table>

</body>
</html>
