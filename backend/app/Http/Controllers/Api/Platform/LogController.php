<?php

namespace App\Http\Controllers\Api\Platform;

use App\Http\Controllers\Controller;
use App\Models\Administration\AuditLog;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use Symfony\Component\HttpFoundation\StreamedResponse;

/** Application log viewer (storage/logs/*.log) — /platform/logs. */
class LogController extends Controller
{
    /** Only the last 10MB of a file is ever parsed — large log files stay fast to browse. */
    private const MAX_READ_BYTES = 10 * 1024 * 1024;

    public function index(): JsonResponse
    {
        $files = collect(File::glob(storage_path('logs/*.log')))
            ->map(fn (string $path) => [
                'name'        => basename($path),
                'size'        => File::size($path),
                'modified_at' => Carbon::createFromTimestamp(File::lastModified($path))->toISOString(),
            ])
            ->sortByDesc('modified_at')
            ->values();

        return response()->json(['data' => $files]);
    }

    public function entries(Request $request): JsonResponse
    {
        $path = $this->resolveFile($request->get('file'));
        abort_unless($path, 404, 'Log file not found');

        $entries = $this->parseEntries($this->readTail($path));

        if ($level = $request->get('level')) {
            $entries = array_values(array_filter(
                $entries,
                fn (array $e) => $e['level'] === strtoupper($level)
            ));
        }

        if ($search = $request->get('search')) {
            $entries = array_values(array_filter(
                $entries,
                fn (array $e) => stripos($e['message'], $search) !== false
            ));
        }

        if ($request->get('sort_direction') !== 'asc') {
            $entries = array_reverse($entries);
        }

        $total   = count($entries);
        $perPage = max(1, (int) $request->get('perPage', 20));
        $page    = max(1, (int) $request->get('page', 1));
        $lastPage = max(1, (int) ceil($total / $perPage));

        $slice = array_slice($entries, ($page - 1) * $perPage, $perPage);
        foreach ($slice as $i => &$entry) {
            $entry['id'] = ($page - 1) * $perPage + $i;
        }

        return response()->json([
            'record' => [
                'data'         => array_values($slice),
                'current_page' => $page,
                'last_page'    => $lastPage,
                'total'        => $total,
                'from'         => $total ? ($page - 1) * $perPage + 1 : 0,
                'to'           => min($page * $perPage, $total),
            ],
            'message' => 'Log entries retrieved successfully',
            'status'  => true,
        ]);
    }

    public function download(Request $request): StreamedResponse
    {
        $path = $this->resolveFile($request->get('file'));
        abort_unless($path, 404, 'Log file not found');

        return response()->download($path, basename($path));
    }

    public function destroy(Request $request): JsonResponse
    {
        $path = $this->resolveFile($request->get('file'));
        abort_unless($path, 404, 'Log file not found');

        file_put_contents($path, '');

        AuditLog::create([
            'system_admin_id' => auth('platform')->id(),
            'action'          => 'delete',
            'form'            => 'Log',
            'record_id'       => null,
            'record'          => basename($path).' (cleared)',
            'ip'              => request()->ip(),
            'browser'         => request()->userAgent(),
        ]);

        return response()->json(['message' => 'Log file cleared successfully']);
    }

    /** Only matches *.log files that actually exist under storage/logs — prevents path traversal. */
    private function resolveFile(?string $name): ?string
    {
        if (! $name) {
            return null;
        }

        $safe = basename($name);
        $path = storage_path("logs/{$safe}");

        return (str_ends_with($safe, '.log') && File::exists($path)) ? $path : null;
    }

    private function readTail(string $path): string
    {
        $size = File::size($path);
        if ($size <= self::MAX_READ_BYTES) {
            return file_get_contents($path);
        }

        $handle = fopen($path, 'r');
        fseek($handle, -self::MAX_READ_BYTES, SEEK_END);
        $content = fread($handle, self::MAX_READ_BYTES);
        fclose($handle);

        // Drop the first (likely partial) line so it isn't parsed as a broken entry.
        $firstNewline = strpos($content, "\n");

        return $firstNewline !== false ? substr($content, $firstNewline + 1) : $content;
    }

    /**
     * Splits raw Laravel log text into entries. A new entry starts at each
     * "[date] env.LEVEL: message" header; every following line (stack
     * traces, multi-line context) is appended to that entry until the next
     * header. Returned oldest-first.
     *
     * @return list<array{datetime: string, environment: string, level: string, message: string}>
     */
    private function parseEntries(string $content): array
    {
        $headerPattern = '/^\[(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2})(?:\.\d+)?(?:[+-]\d{2}:\d{2})?\]\s+(\S+)\.(\w+):\s?(.*)$/';

        $entries = [];
        $current = null;
        $extra   = [];

        foreach (preg_split('/\r\n|\r|\n/', $content) as $line) {
            if (preg_match($headerPattern, $line, $m)) {
                if ($current !== null) {
                    $current['message'] = trim($current['message']."\n".implode("\n", $extra));
                    $entries[] = $current;
                }

                $current = [
                    'datetime'    => $this->toDisplayTimezone($m[1]),
                    'environment' => $m[2],
                    'level'       => strtoupper($m[3]),
                    'message'     => rtrim($m[4]),
                ];
                $extra = [];
            } elseif ($current !== null) {
                $extra[] = $line;
            }
        }

        if ($current !== null) {
            $current['message'] = trim($current['message']."\n".implode("\n", $extra));
            $entries[] = $current;
        }

        return $entries;
    }

    /**
     * Log lines are written in the app's storage timezone (config('app.timezone'),
     * UTC) — convert to the same display timezone the log-viewer package uses
     * (config('log-viewer.timezone')) so both log views agree.
     */
    private function toDisplayTimezone(string $rawDatetime): string
    {
        return Carbon::createFromFormat('Y-m-d H:i:s', str_replace('T', ' ', $rawDatetime), config('app.timezone'))
            ->setTimezone(config('log-viewer.timezone') ?: config('app.timezone'))
            ->format('Y-m-d H:i:s');
    }
}
