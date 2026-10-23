<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
    @page { margin: 28px 32px; }
    body { font-family: 'Helvetica', 'DejaVu Sans', sans-serif; font-size: 11px; color: #1f2937; }
    table { width: 100%; border-collapse: collapse; }
    .header-table td { vertical-align: top; }
    .logo { max-height: 56px; max-width: 160px; }
    .company-name { font-size: 16px; font-weight: bold; color: #111827; }
    .muted { color: #6b7280; }
    .doc-title { font-size: 22px; font-weight: bold; text-align: right; color: #111827; text-transform: uppercase; letter-spacing: 1px; }
    .doc-meta td { padding: 1px 0; text-align: right; }
    .doc-meta .label { color: #6b7280; padding-right: 10px; }
    .section-title { font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; color: #9ca3af; margin-bottom: 4px; font-weight: bold; }
    .bill-to { margin-top: 22px; }
    .bill-to-box { width: 48%; }
    .items-table { margin-top: 20px; }
    .items-table th { background: #f3f4f6; text-align: left; padding: 6px 8px; font-size: 9.5px; text-transform: uppercase; color: #4b5563; border-bottom: 2px solid #e5e7eb; }
    .items-table td { padding: 6px 8px; border-bottom: 1px solid #f1f1f1; }
    .items-table .num { text-align: right; }
    .summary-table { width: 100%; }
    .summary-table td { padding: 3px 0; }
    .summary-table .label { color: #6b7280; }
    .summary-table .value { text-align: right; }
    .summary-table .grand-total td { border-top: 2px solid #111827; font-weight: bold; font-size: 13px; padding-top: 6px; }
    .summary-table .balance td { font-weight: bold; color: #b45309; }
    .status-badge { display: inline-block; padding: 3px 10px; border-radius: 4px; font-size: 10px; font-weight: bold; text-transform: uppercase; }
    .terms { margin-top: 40px; font-size: 9.5px; color: #4b5563; }
    .terms .section-title { margin-bottom: 3px; }
    .terms p { margin: 0 0 6px; }
    .terms ul, .terms ol { margin: 0 0 6px; padding-left: 16px; }
    .terms blockquote { margin: 0 0 6px; padding-left: 8px; border-left: 2px solid #d1d5db; color: #6b7280; }
    .terms a { color: #2563eb; }
    .footer-note { margin-top: 24px; padding-top: 10px; border-top: 1px solid #e5e7eb; font-size: 9px; color: #9ca3af; text-align: center; }
</style>
</head>
<body>

<table class="header-table">
    <tr>
        <td style="width: 55%;">
            @if($company->logo)
                <img class="logo" src="{{ $company->logo }}" alt="logo">
            @else
                <div class="company-name">{{ $company->name }}</div>
            @endif
            @if($company->logo)
                <div class="company-name" style="margin-top:4px;">{{ $company->name }}</div>
            @endif
            @if($company->legal_name && $company->legal_name !== $company->name)
                <div class="muted">{{ $company->legal_name }}</div>
            @endif
            @if($company->trn)
                <div class="muted">TRN: {{ $company->trn }}</div>
            @endif
            <div class="muted">
                {{ implode(', ', array_filter([$company->address_line_1, $company->city, $company->emirate, $company->country])) }}
            </div>
            <div class="muted">
                {{ implode(' &middot; ', array_filter([$company->phone, $company->email])) }}
            </div>
        </td>
        <td style="width: 45%;">
            <div class="doc-title">{{ $docTitle }}</div>
            <table class="doc-meta">
                <tr><td class="label">{{ $docTitle }} #</td><td>{{ $docNumber }}</td></tr>
                <tr><td class="label">Date</td><td>{{ $docDate }}</td></tr>
                @if($secondaryDateLabel)
                    <tr><td class="label">{{ $secondaryDateLabel }}</td><td>{{ $secondaryDate }}</td></tr>
                @endif
                <tr><td class="label">Status</td><td><span class="status-badge" style="background:{{ $statusColor }}20; color:{{ $statusColor }};">{{ ucfirst(str_replace('_',' ', $status)) }}</span></td></tr>
            </table>
        </td>
    </tr>
</table>

<table class="bill-to">
    <tr>
        <td class="bill-to-box">
            <div class="section-title">Bill To</div>
            <div style="font-weight:bold;">{{ $customer->display_name }}</div>
            @if($customer->trn)
                <div class="muted">TRN: {{ $customer->trn }}</div>
            @endif
            <div class="muted">
                {{ implode(', ', array_filter([$customer->address_line_1, $customer->city, $customer->emirate])) ?: '&mdash;' }}
            </div>
            <div class="muted">{{ implode(' &middot; ', array_filter([$customer->email, $customer->phone])) }}</div>
        </td>
    </tr>
</table>

<table class="items-table">
    <thead>
        <tr>
            <th style="width:40%;">Description</th>
            <th class="num">Qty</th>
            <th class="num">Unit Price</th>
            <th class="num">Discount</th>
            <th class="num">VAT</th>
            <th class="num">Total</th>
        </tr>
    </thead>
    <tbody>
        @foreach($items as $item)
        <tr>
            <td>{{ $item->description }}</td>
            <td class="num">{{ number_format($item->quantity, 2) }}</td>
            <td class="num">{{ number_format($item->unit_price, 2) }}</td>
            <td class="num">{{ number_format($item->discount_amount, 2) }}</td>
            <td class="num">{{ number_format($item->tax_amount, 2) }} ({{ number_format($item->tax_rate, 0) }}%)</td>
            <td class="num">{{ number_format($item->total, 2) }}</td>
        </tr>
        @endforeach
    </tbody>
</table>

<table style="margin-top:14px;">
    <tr>
        <td style="width:60%;"></td>
        <td style="width:40%;">
            <table class="summary-table">
                <tr><td class="label">Subtotal</td><td class="value">{{ $currency }} {{ number_format($document->subtotal, 2) }}</td></tr>
                @if($document->discount_amount > 0)
                <tr><td class="label">Discount</td><td class="value">- {{ $currency }} {{ number_format($document->discount_amount, 2) }}</td></tr>
                @endif
                <tr><td class="label">Taxable Amount</td><td class="value">{{ $currency }} {{ number_format($document->taxable_amount, 2) }}</td></tr>
                <tr><td class="label">VAT</td><td class="value">{{ $currency }} {{ number_format($document->tax_amount, 2) }}</td></tr>
                <tr class="grand-total"><td>Grand Total</td><td class="value">{{ $currency }} {{ number_format($document->total, 2) }}</td></tr>
                @if(isset($document->paid_amount))
                <tr><td class="label">Paid</td><td class="value">{{ $currency }} {{ number_format($document->paid_amount, 2) }}</td></tr>
                <tr class="balance"><td>Balance Due</td><td class="value">{{ $currency }} {{ number_format($document->balance_amount, 2) }}</td></tr>
                @endif
            </table>
        </td>
    </tr>
</table>

<div class="terms">
    @if($document->notes)
        <div class="section-title">Notes</div>
        <div style="margin-bottom:10px;">{{ $document->notes }}</div>
    @endif
    @if($document->terms)
        <div class="section-title">Terms &amp; Conditions</div>
        <div>{!! $document->terms !!}</div>
    @endif
</div>

<div class="footer-note">
    {{ $company->name }}
    @if($company->email) &middot; {{ $company->email }} @endif
    @if($company->phone) &middot; {{ $company->phone }} @endif
    &middot; Generated by Enscone
</div>

</body>
</html>
