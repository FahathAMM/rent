<?php

namespace App\Exports;

use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithHeadings;

/**
 * One reusable export for every report in ReportService — each report
 * already shapes its data as {columns, rows}, so a single generic export
 * (used for both CSV and XLSX) covers all of them instead of one class per
 * report type.
 */
class ArrayExport implements FromArray, WithHeadings
{
    public function __construct(private array $columns, private array $rows) {}

    public function headings(): array
    {
        return $this->columns;
    }

    public function array(): array
    {
        return array_map(fn ($row) => array_map(fn ($col) => $row[$col] ?? '', $this->columns), $this->rows);
    }
}
