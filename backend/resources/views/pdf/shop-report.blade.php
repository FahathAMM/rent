@php
    $right = fn (array $column) => in_array($column['type'], ['money', 'number', 'percent'], true);
@endphp
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>{{ $title }}</title>
<style>
    @page { margin: 32px 36px 48px; }
    body { font-family: 'DejaVu Sans', 'Helvetica', sans-serif; font-size: 9px; color: #1f2937; }
    table { width: 100%; border-collapse: collapse; }
    .shop { font-size: 10px; color: #64748b; }
    h1 { font-size: 16px; margin: 2px 0; color: #0f172a; }
    .period { color: #64748b; }
    .rule { border-top: 2px solid #0f172a; margin: 8px 0 12px; }
    .summary td { padding: 6px 8px; border: 1px solid #e2e8f0; background: #f8fafc; }
    .k { font-size: 7.5px; text-transform: uppercase; letter-spacing: .5px; color: #64748b; }
    .v { font-size: 11px; font-weight: bold; color: #0f172a; }
    .rows { margin-top: 12px; }
    .rows th { text-align: left; padding: 5px 6px; background: #0f172a; color: #fff; font-size: 8px; }
    .rows td { padding: 4px 6px; border-bottom: 1px solid #e2e8f0; }
    .num { text-align: right; }
    .note { margin-top: 10px; color: #64748b; font-style: italic; }
    .empty { padding: 16px; text-align: center; color: #94a3b8; }
    .footer { position: fixed; bottom: -30px; left: 0; right: 0; font-size: 7.5px; color: #94a3b8; }
</style>
</head>
<body>

<div class="footer">{{ $shop?->name }} · {{ $title }} · Printed {{ now()->format('d M Y, h:i A') }}</div>

<div class="shop">{{ $shop?->name }}</div>
<h1>{{ $title }}</h1>
<div class="period">{{ $dated ? $from->format('d M Y') . ' – ' . $to->format('d M Y') : 'As of ' . now()->format('d M Y') }}</div>
<div class="rule"></div>

<table class="summary">
    <tr>
        @foreach ($summary as $tile)
            <td>
                <div class="k">{{ $tile['label'] }}</div>
                <div class="v">{{ $tile['type'] === 'money' ? 'LKR ' . number_format((float) $tile['value'], 2) : $tile['value'] . ($tile['type'] === 'percent' ? '%' : '') }}</div>
            </td>
        @endforeach
    </tr>
</table>

<table class="rows">
    <thead>
        <tr>
            @foreach ($columns as $column)
                <th class="{{ $right($column) ? 'num' : '' }}">{{ $column['label'] }}</th>
            @endforeach
        </tr>
    </thead>
    <tbody>
        @forelse ($rows as $row)
            <tr>
                @foreach ($columns as $column)
                    <td class="{{ $right($column) ? 'num' : '' }}">{{ $cell($column, $row[$column['key']] ?? null) }}</td>
                @endforeach
            </tr>
        @empty
            <tr><td colspan="{{ count($columns) }}" class="empty">Nothing in this period.</td></tr>
        @endforelse
    </tbody>
</table>

@if ($note)
    <p class="note">{{ $note }}</p>
@endif

</body>
</html>
