@php
    // The marketplace's own name (platform settings), not Laravel's APP_NAME.
    $brand = \App\Models\PlatformDetail::current()?->name ?: config('app.name');
    $cur = $pricing?->currency ?? 'LKR';
    $money = fn ($v) => $cur . ' ' . number_format((float) $v, 2);
    $when = fn ($d) => $d ? $d->format('D, d M Y · h:i A') : '—';
    $methodLabel = [
        'cash' => 'Cash to the shop at pickup',
        'bank_transfer' => 'Bank transfer to the shop (any balance at pickup)',
        'online' => 'Paid online',
    ][$booking->payment_method] ?? ucfirst((string) $booking->payment_method);
    $statusLabel = ucwords(str_replace('_', ' ', $booking->status));
    $paid = $booking->amountPaid();
    $balance = $booking->balanceDue();
    $pickup = $booking->pickupLocation;
    $return = $booking->returnLocation;
    // Money received only - the booking charge and price adjustments are statement lines, not payments.
    $received = $booking->payments->where('status', \App\Models\Payment::STATUS_SUCCEEDED)->whereNotNull('method')->sortBy('paid_at');
    // The deposit part the shop kept at return (with the reason), if any.
    $damageKept = $booking->payments->where('status', \App\Models\Payment::STATUS_SUCCEEDED)->where('type', \App\Models\Payment::TYPE_DAMAGE);
    // Latest shop date change, if any. "originally" shows the first change's old dates, i.e. what was first booked.
    $dateChanges = $booking->dateChanges;
    $dateChange = $dateChanges->first();
    $dateChangeCount = $dateChanges->count();
    if ($dateChange) {
        $dateChange = clone $dateChange;
        $dateChange->from_value = $dateChanges->last()->from_value;
    }
@endphp
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>{{ $booking->booking_reference }}</title>
<style>
    @page { margin: 28px 32px; }
    body { font-family: 'DejaVu Sans', 'Helvetica', sans-serif; font-size: 10.5px; color: #1f2937; }
    table { width: 100%; border-collapse: collapse; }
    .header-table td { vertical-align: top; }
    .brand { font-size: 10px; color: #9ca3af; letter-spacing: 0.5px; text-transform: uppercase; }
    .shop-name { font-size: 16px; font-weight: bold; color: #111827; margin-top: 2px; }
    .muted { color: #6b7280; }
    .doc-title { font-size: 18px; font-weight: bold; text-align: right; color: #111827; text-transform: uppercase; letter-spacing: 1px; }
    .doc-meta { text-align: right; color: #6b7280; margin-top: 4px; }
    .ref-box { margin-top: 18px; border: 2px solid #111827; border-radius: 6px; padding: 10px 14px; }
    .ref-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; }
    .ref { font-size: 22px; font-weight: bold; letter-spacing: 1px; color: #111827; }
    .status { display: inline-block; padding: 3px 10px; border-radius: 10px; font-weight: bold; font-size: 10px; background: #dcfce7; color: #166534; }
    .status.pending { background: #fef3c7; color: #92400e; }
    .status.ended { background: #f3f4f6; color: #4b5563; }
    .section-title { font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; color: #9ca3af; margin-bottom: 4px; font-weight: bold; }
    .box { margin-top: 18px; }
    .box-half { width: 48%; vertical-align: top; }
    .info-table td { padding: 2px 0; vertical-align: top; }
    .info-table .label { color: #6b7280; width: 38%; }
    .info-table .value { font-weight: bold; }
    .lines td { padding: 4px 0; border-bottom: 1px solid #f3f4f6; }
    .lines .amt { text-align: right; }
    .lines .total td { border-top: 1.5px solid #111827; border-bottom: none; font-weight: bold; font-size: 12px; padding-top: 6px; }
    .lines .strong td { font-weight: bold; }
    .due { color: #b45309; }
    .ok { color: #15803d; }
    .policy { margin-top: 6px; }
    .policy-title { font-weight: bold; }
    .date-change { margin-top: 10px; padding: 8px 12px; background: #fffbeb; border: 1px solid #fcd34d; border-radius: 6px; color: #92400e; }
    .notice { margin-top: 18px; padding: 8px 12px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; }
    .signatures { margin-top: 40px; }
    .sig-box { width: 45%; }
    .sig-line { border-top: 1px solid #111827; margin-top: 34px; padding-top: 4px; font-size: 9.5px; color: #4b5563; }
    .footer-note { margin-top: 24px; padding-top: 8px; border-top: 1px solid #e5e7eb; font-size: 8.5px; color: #9ca3af; text-align: center; }
</style>
</head>
<body>

<table class="header-table">
    <tr>
        <td style="width: 58%;">
            <div class="brand">{{ $brand }} · Booking confirmation</div>
            <div class="shop-name">{{ $shop->name }}</div>
            <div class="muted">
                {{ implode(', ', array_filter([$shop->address_line_1, $shop->address_line_2, $shop->city, $shop->district])) ?: '' }}
            </div>
            <div class="muted">{{ implode(' · ', array_filter([$shop->phone, $shop->whatsapp ? 'WhatsApp ' . $shop->whatsapp : null, $shop->email])) }}</div>
        </td>
        <td style="width: 42%;">
            <div class="doc-title">Booking Voucher</div>
            <div class="doc-meta">Issued {{ now()->format('d M Y, h:i A') }}</div>
        </td>
    </tr>
</table>

<table class="ref-box">
    <tr>
        <td>
            <div class="ref-label">Booking reference</div>
            <div class="ref">{{ $booking->booking_reference }}</div>
        </td>
        <td style="text-align: right; vertical-align: middle;">
            @php
                $cls = in_array($booking->status, ['confirmed', 'active', 'completed'], true) ? '' : ($booking->status === 'pending' ? 'pending' : 'ended');
            @endphp
            <span class="status {{ $cls }}">{{ $statusLabel }}</span>
        </td>
    </tr>
</table>

@if ($dateChange)
{{-- The shop moved the dates: say so up front, so the voucher can't be mistaken for an older copy. --}}
<div class="date-change">
    <strong>Dates changed by the shop</strong> on {{ $dateChange->created_at->format('d M Y, h:i A') }}
    — originally {{ $dateChange->from_value }}.
    @if ($dateChange->reason) Reason: {{ $dateChange->reason }}@endif
    @if ($dateChangeCount > 1) ({{ $dateChangeCount }} changes in total; the dates below are the latest.)@endif
</div>
@endif

<table class="box">
    <tr>
        <td class="box-half">
            <div class="section-title">Customer</div>
            <table class="info-table">
                <tr><td class="label">Name</td><td class="value">{{ $customer->name }}</td></tr>
                <tr><td class="label">Phone</td><td class="value">{{ $customer->phone ?: '—' }}</td></tr>
                <tr><td class="label">Email</td><td class="value">{{ $customer->email }}</td></tr>
            </table>
        </td>
        <td style="width: 4%;"></td>
        <td class="box-half">
            <div class="section-title">Vehicle</div>
            <table class="info-table">
                <tr><td class="label">Vehicle</td><td class="value">{{ $vehicle->title }}</td></tr>
                <tr><td class="label">Make / model</td><td class="value">{{ trim($vehicle->make . ' ' . $vehicle->model) ?: '—' }}</td></tr>
                <tr><td class="label">Reg. no.</td><td class="value">{{ $vehicle->registration_number ?: '—' }}</td></tr>
                <tr><td class="label">Extras</td><td class="value">{{ implode(', ', array_filter([$booking->with_driver ? 'With driver' : null, $booking->delivery_requested ? 'Delivery' : null])) ?: 'None' }}</td></tr>
            </table>
        </td>
    </tr>
</table>

<table class="box">
    <tr>
        <td class="box-half">
            <div class="section-title">Pickup</div>
            <table class="info-table">
                <tr><td class="label">When</td><td class="value">{{ $when($booking->pickup_at) }}</td></tr>
                <tr><td class="label">Where</td><td class="value">{{ $pickup?->name ?? ($booking->pickup_address ?: 'At the shop') }}</td></tr>
                @if ($pickup?->address)<tr><td class="label"></td><td class="muted">{{ implode(', ', array_filter([$pickup->address, $pickup->city])) }}</td></tr>@endif
            </table>
        </td>
        <td style="width: 4%;"></td>
        <td class="box-half">
            <div class="section-title">Return</div>
            <table class="info-table">
                <tr><td class="label">When</td><td class="value">{{ $when($booking->return_at) }}</td></tr>
                <tr><td class="label">Where</td><td class="value">{{ $return?->name ?? ($booking->return_address ?: ($pickup?->name ?? 'At the shop')) }}</td></tr>
                <tr><td class="label">Duration</td><td class="value">{{ $booking->rental_days }} day{{ $booking->rental_days == 1 ? '' : 's' }}</td></tr>
            </table>
        </td>
    </tr>
</table>

<table class="box">
    <tr>
        <td class="box-half">
            <div class="section-title">Price</div>
            <table class="lines">
                <tr><td>Base rental ({{ $booking->rental_days }} day{{ $booking->rental_days == 1 ? '' : 's' }})</td><td class="amt">{{ $money($pricing->base_amount) }}</td></tr>
                @if ((float) $pricing->driver_amount > 0)<tr><td>Driver</td><td class="amt">{{ $money($pricing->driver_amount) }}</td></tr>@endif
                @if ((float) $pricing->delivery_amount > 0)<tr><td>Delivery</td><td class="amt">{{ $money($pricing->delivery_amount) }}</td></tr>@endif
                @if ((float) $pricing->discount_amount > 0)<tr><td>Discount</td><td class="amt">− {{ $money($pricing->discount_amount) }}</td></tr>@endif
                @if ((float) $pricing->tax_amount > 0)<tr><td>Tax</td><td class="amt">{{ $money($pricing->tax_amount) }}</td></tr>@endif
                @if ((float) $pricing->security_deposit > 0)<tr><td>Security deposit (refundable)</td><td class="amt">{{ $money($pricing->security_deposit) }}</td></tr>@endif
                <tr class="total"><td>Total</td><td class="amt">{{ $money($pricing->total_payable) }}</td></tr>
            </table>
        </td>
        <td style="width: 4%;"></td>
        <td class="box-half">
            <div class="section-title">Payment</div>
            <table class="info-table">
                <tr><td class="label">Method</td><td class="value">{{ $methodLabel }}</td></tr>
            </table>
            <table class="lines" style="margin-top: 6px;">
                @forelse ($received as $p)
                    @php($paidBack = (float) $p->debit > 0)
                    <tr>
                        <td>{{ $p->paid_at?->format('d M Y') }} · {{ $p->method === 'bank' ? 'Bank transfer' : 'Cash' }}{{ $paidBack ? ($p->type === 'security_deposit' ? ' — deposit handed back' : ' — paid back') : '' }}{{ $p->transfer_reference ? ' (' . $p->transfer_reference . ')' : '' }}</td>
                        <td class="amt">{{ $paidBack ? '−' : '' }}{{ $money($p->amount) }}</td>
                    </tr>
                @empty
                    <tr><td class="muted" colspan="2">No payment received yet.</td></tr>
                @endforelse
                @foreach ($damageKept as $d)
                    <tr><td>Kept from deposit{{ $d->note ? ' — ' . $d->note : '' }}</td><td class="amt">{{ $money($d->debit) }}</td></tr>
                @endforeach
                <tr class="strong"><td>Paid</td><td class="amt ok">{{ $money($paid) }}</td></tr>
                <tr class="total"><td>{{ $balance > 0 ? 'Balance due' : 'Fully paid' }}</td><td class="amt {{ $balance > 0 ? 'due' : 'ok' }}">{{ $money($balance) }}</td></tr>
            </table>
        </td>
    </tr>
</table>

@if ($booking->customer_note)
<div class="box">
    <div class="section-title">Customer note</div>
    <div>{{ $booking->customer_note }}</div>
</div>
@endif

<div class="notice">
    <strong>At pickup:</strong> show this voucher (printed or on your phone) together with your driving licence and NIC/passport.
    @if ($balance > 0)
        Please be ready to pay the balance of <strong>{{ $money($balance) }}</strong>.
    @endif
</div>

@if (!empty($shop->policies))
<div class="box">
    <div class="section-title">Shop policies</div>
    @foreach ($shop->policies as $policy)
        <div class="policy"><span class="policy-title">{{ $policy['title'] ?? '' }}:</span> {{ $policy['body'] ?? '' }}</div>
    @endforeach
</div>
@endif

<table class="signatures">
    <tr>
        <td class="sig-box"><div class="sig-line">Customer signature</div></td>
        <td style="width: 10%;"></td>
        <td class="sig-box"><div class="sig-line">For {{ $shop->name }}</div></td>
    </tr>
</table>

<div class="footer-note">
    {{ $brand }} · Booking {{ $booking->booking_reference }} · Booked on {{ $booking->created_at?->format('d M Y') }}.
    The shop can confirm this booking by its reference.
</div>

</body>
</html>
