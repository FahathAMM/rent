<?php

namespace App\Http\Controllers\Api\Platform;

use App\Http\Controllers\Controller;
use App\Mail\DatabaseBackupMail;
use App\Models\Administration\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Number;
use Spatie\Backup\BackupDestination\Backup;
use Spatie\Backup\BackupDestination\BackupDestination;
use Symfony\Component\HttpFoundation\StreamedResponse;

/** Database backups (Spatie Laravel Backup) — /platform/settings "Database Backups". */
class BackupController extends Controller
{
    public function index(): JsonResponse
    {
        $backups = $this->destination()->backups()
            ->sortByDesc(fn (Backup $backup) => $backup->date())
            ->values()
            ->map(fn (Backup $backup) => [
                'path'       => $backup->path(),
                'size'       => $backup->sizeInBytes(),
                'created_at' => $backup->date()->toIso8601String(),
            ]);

        return response()->json(['data' => $backups]);
    }

    public function store(): JsonResponse
    {
        Artisan::call('backup:run', [
            '--only-db'                => true,
            '--disable-notifications'  => true,
        ]);

        $this->audit('create', 'Database backup');

        return response()->json(['message' => 'Database backup created successfully']);
    }

    public function download(Request $request): StreamedResponse
    {
        $request->validate(['path' => 'required|string']);

        $backup = $this->findBackup($request->string('path')->toString());
        abort_unless($backup?->exists(), 404, 'Backup not found');

        $this->audit('download', basename($backup->path()));

        return response()->streamDownload(
            fn () => fpassthru($backup->stream()),
            basename($backup->path())
        );
    }

    public function email(Request $request): JsonResponse
    {
        $data = $request->validate([
            'path'    => 'required|string',
            'to'      => 'required|email',
            'cc'      => 'nullable|array',
            'cc.*'    => 'email',
            'message' => 'nullable|string|max:2000',
        ]);

        $backup = $this->findBackup($data['path']);
        abort_unless($backup?->exists(), 404, 'Backup not found');

        Mail::to($data['to'])
            ->cc($data['cc'] ?? [])
            ->send(new DatabaseBackupMail(
                appName: config('app.name'),
                backupFilename: basename($backup->path()),
                backupDate: $backup->date()->toDayDateTimeString(),
                backupSize: Number::fileSize($backup->sizeInBytes(), precision: 1),
                customMessage: $data['message'] ?? null,
                zipBinary: $backup->disk()->get($backup->path()),
            ));

        $this->audit('email', basename($backup->path())." → {$data['to']}");

        return response()->json(['message' => "Database backup emailed to {$data['to']}"]);
    }

    public function destroy(Request $request): JsonResponse
    {
        $request->validate(['path' => 'required|string']);

        $backup = $this->findBackup($request->string('path')->toString());
        abort_unless($backup?->exists(), 404, 'Backup not found');

        $filename = basename($backup->path());

        // Spatie's Backup::delete() never throws and never returns a result —
        // on failure it just logs and returns void, so the only way to know
        // whether the file actually went away is to check exists() again.
        // Without this check, a permission error on the server (a very
        // common cause: the backup file is owned by the user the scheduler/
        // cron runs as, not the user the web server runs as, so it can list
        // and read the file but not delete it) would report success here
        // while the file silently remains.
        $backup->delete();

        if ($backup->exists()) {
            Log::warning("Backup delete reported no error but file still exists: {$filename}");

            return response()->json([
                'message' => "Could not delete \"{$filename}\" — the server rejected the delete, most likely a file permission issue. Check that the web server process can write to the backup storage directory.",
            ], 500);
        }

        $this->audit('delete', $filename);

        return response()->json(['message' => 'Backup deleted successfully']);
    }

    /** Only matches paths already present in the backup destination — prevents path traversal. */
    private function findBackup(string $path): ?Backup
    {
        return $this->destination()->backups()->first(fn (Backup $backup) => $backup->path() === $path);
    }

    private function destination(): BackupDestination
    {
        return BackupDestination::create(
            config('backup.backup.destination.disks')[0],
            config('backup.backup.name')
        );
    }

    private function audit(string $action, string $record): void
    {
        AuditLog::create([
            'system_admin_id' => auth('platform')->id(),
            'action'          => $action,
            'form'            => 'Backup',
            'record_id'       => null,
            'record'          => $record,
            'ip'              => request()->ip(),
            'browser'         => request()->userAgent(),
        ]);
    }
}
