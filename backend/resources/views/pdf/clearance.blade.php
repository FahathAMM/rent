<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
    @page { margin: 28px 32px; }
    body { font-family: 'Helvetica', 'DejaVu Sans', sans-serif; font-size: 11px; color: #1f2937; }
    table { width: 100%; border-collapse: collapse; }
    .header-table td { vertical-align: top; }
    .company-name { font-size: 16px; font-weight: bold; color: #111827; }
    .muted { color: #6b7280; }
    .doc-title { font-size: 20px; font-weight: bold; text-align: right; color: #111827; text-transform: uppercase; letter-spacing: 1px; }
    .doc-meta { text-align: right; color: #6b7280; margin-top: 4px; }
    .section-title { font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; color: #9ca3af; margin-bottom: 4px; font-weight: bold; }
    .box { margin-top: 22px; }
    .info-table td { padding: 2px 0; }
    .info-table .label { color: #6b7280; width: 30%; }
    .info-table .value { font-weight: bold; }
    .assets-table { margin-top: 10px; }
    .assets-table th { background: #f3f4f6; text-align: left; padding: 6px 8px; font-size: 9.5px; text-transform: uppercase; color: #4b5563; border-bottom: 2px solid #e5e7eb; }
    .assets-table td { padding: 6px 8px; border-bottom: 1px solid #f1f1f1; }
    .stamp { margin-top: 30px; padding: 14px; border: 2px solid #059669; border-radius: 6px; text-align: center; }
    .stamp .title { font-size: 16px; font-weight: bold; color: #059669; text-transform: uppercase; letter-spacing: 1px; }
    .signatures { margin-top: 50px; }
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
            <div class="doc-title">Asset Clearance Certificate</div>
            <div class="doc-meta">Cleared: {{ $offboarding->completed_at->format('d M Y') }}</div>
        </td>
    </tr>
</table>

<table class="box">
    <tr>
        <td>
            <div class="section-title">Employee</div>
            <table class="info-table">
                <tr><td class="label">Name</td><td class="value">{{ $employee->first_name }} {{ $employee->last_name }}</td></tr>
                <tr><td class="label">Employee ID</td><td class="value">{{ $employee->employee_code }}</td></tr>
                <tr><td class="label">Department</td><td class="value">{{ $employee->department->name ?? '—' }}</td></tr>
                <tr><td class="label">Offboarding Initiated</td><td class="value">{{ $offboarding->initiated_at->format('d M Y') }}</td></tr>
            </table>
        </td>
    </tr>
</table>

<div class="box">
    <div class="section-title">Assets Returned</div>
    <table class="assets-table">
        <thead>
            <tr><th>Asset Code</th><th>Description</th><th>Assigned</th><th>Returned</th><th>Condition</th></tr>
        </thead>
        <tbody>
            @forelse($assignments as $a)
            <tr>
                <td>{{ $a->asset->asset_code }}</td>
                <td>{{ trim(($a->asset->brand ?? '').' '.($a->asset->model ?? '')) ?: $a->asset->category->name }}</td>
                <td>{{ $a->assigned_at->format('d M Y') }}</td>
                <td>{{ $a->returned_at?->format('d M Y') ?? '—' }}</td>
                <td style="text-transform:capitalize">{{ $a->returned_condition ?? '—' }}</td>
            </tr>
            @empty
            <tr><td colspan="5" class="muted">No assets were ever assigned to this employee.</td></tr>
            @endforelse
        </tbody>
    </table>
</div>

<div class="stamp">
    <div class="title">Clearance Completed</div>
    <p class="muted" style="margin:4px 0 0;">All company assets have been returned and accounted for.</p>
</div>

<table class="signatures">
    <tr>
        <td class="sig-box">
            <div class="sig-line">Employee Signature</div>
        </td>
        <td style="width: 10%;"></td>
        <td class="sig-box">
            <div class="sig-line">HR / Admin Signature</div>
        </td>
    </tr>
</table>

<div class="footer-note">Generated on {{ now()->format('d M Y, H:i') }} — {{ $company->name }}</div>

</body>
</html>
