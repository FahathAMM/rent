<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
    @page { margin: 24px 28px; }
    body { font-family: 'Helvetica', 'DejaVu Sans', sans-serif; font-size: 9.5px; color: #1f2937; }
    .company-name { font-size: 15px; font-weight: bold; color: #111827; }
    .doc-title { font-size: 16px; font-weight: bold; color: #111827; margin-top: 2px; }
    .muted { color: #6b7280; }
    table.data { width: 100%; border-collapse: collapse; margin-top: 14px; }
    table.data th { background: #f3f4f6; text-align: left; padding: 5px 6px; font-size: 8.5px; text-transform: uppercase; letter-spacing: 0.3px; color: #374151; border-bottom: 1px solid #d1d5db; }
    table.data td { padding: 4px 6px; border-bottom: 1px solid #f0f1f3; }
    table.data tr:nth-child(even) { background: #fafafa; }
    .footer-note { margin-top: 20px; padding-top: 8px; border-top: 1px solid #e5e7eb; font-size: 8px; color: #9ca3af; text-align: center; }
</style>
</head>
<body>

<div class="company-name">{{ $company->name }}</div>
<div class="doc-title">{{ $title }}</div>
<div class="muted">Generated {{ now()->format('d M Y, H:i') }} &middot; {{ count($rows) }} record{{ count($rows) === 1 ? '' : 's' }}</div>

<table class="data">
    <thead>
        <tr>
            @foreach($columns as $column)
                <th>{{ $column }}</th>
            @endforeach
        </tr>
    </thead>
    <tbody>
        @forelse($rows as $row)
            <tr>
                @foreach($columns as $column)
                    <td>{{ $row[$column] ?? '' }}</td>
                @endforeach
            </tr>
        @empty
            <tr><td colspan="{{ count($columns) }}" class="muted">No records found.</td></tr>
        @endforelse
    </tbody>
</table>

<div class="footer-note">{{ $company->name }}</div>

</body>
</html>
