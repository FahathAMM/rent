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
    .doc-title { font-size: 20px; font-weight: bold; text-align: right; color: #111827; text-transform: uppercase; letter-spacing: 1px; }
    .doc-meta { text-align: right; color: #6b7280; margin-top: 4px; }
    .section-title { font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; color: #9ca3af; margin-bottom: 4px; font-weight: bold; }
    .box { margin-top: 22px; }
    .box-half { width: 48%; }
    .info-table td { padding: 2px 0; }
    .info-table .label { color: #6b7280; width: 40%; }
    .info-table .value { font-weight: bold; }
    .checklist li { margin-bottom: 2px; }
    .checklist .missing { color: #b91c1c; text-decoration: line-through; }
    .signatures { margin-top: 60px; }
    .sig-box { width: 45%; }
    .sig-line { border-top: 1px solid #111827; margin-top: 40px; padding-top: 4px; font-size: 9.5px; color: #4b5563; }
    .footer-note { margin-top: 30px; padding-top: 10px; border-top: 1px solid #e5e7eb; font-size: 9px; color: #9ca3af; text-align: center; }
</style>
</head>
<body>

<table class="header-table">
    <tr>
        <td style="width: 55%;">
            <div class="company-name">{{ $company->name }}</div>
            <div class="muted">
                {{ implode(', ', array_filter([$company->address_line_1, $company->city, $company->emirate, $company->country])) }}
            </div>
        </td>
        <td style="width: 45%;">
            <div class="doc-title">Asset Return Form</div>
            <div class="doc-meta">Returned: {{ $assignment->returned_at->format('d M Y') }}</div>
        </td>
    </tr>
</table>

<table class="box">
    <tr>
        <td class="box-half">
            <div class="section-title">Employee</div>
            <table class="info-table">
                <tr><td class="label">Name</td><td class="value">{{ $employee->first_name }} {{ $employee->last_name }}</td></tr>
                <tr><td class="label">Employee ID</td><td class="value">{{ $employee->employee_code }}</td></tr>
            </table>
        </td>
        <td class="box-half">
            <div class="section-title">Asset</div>
            <table class="info-table">
                <tr><td class="label">Asset</td><td class="value">{{ trim(($asset->brand ?? '').' '.($asset->model ?? '')) ?: $asset->category->name }}</td></tr>
                <tr><td class="label">Asset Code</td><td class="value">{{ $asset->asset_code }}</td></tr>
                <tr><td class="label">Condition on Return</td><td class="value" style="text-transform:capitalize">{{ $assignment->returned_condition }}</td></tr>
            </table>
        </td>
    </tr>
</table>

<div class="box">
    <div class="section-title">Accessories</div>
    @if(!empty($assignment->accessories))
        <ul class="checklist">
            @foreach($assignment->accessories as $item)
                @php $returned = in_array($item, $assignment->accessories_returned ?? []); @endphp
                <li class="{{ $returned ? '' : 'missing' }}">{{ $returned ? '✓' : '✗' }} {{ $item }}</li>
            @endforeach
        </ul>
    @else
        <p class="muted">None recorded.</p>
    @endif
</div>

@if($assignment->return_notes)
<div class="box">
    <div class="section-title">Damage / Remarks</div>
    <p>{{ $assignment->return_notes }}</p>
</div>
@endif

<table class="signatures">
    <tr>
        <td class="sig-box">
            <div class="sig-line">Employee Acknowledgement</div>
        </td>
        <td style="width: 10%;"></td>
        <td class="sig-box">
            <div class="sig-line">IT / Admin Acknowledgement</div>
        </td>
    </tr>
</table>

<div class="footer-note">Generated on {{ now()->format('d M Y, H:i') }} — {{ $company->name }}</div>

</body>
</html>
