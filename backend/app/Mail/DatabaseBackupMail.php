<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/** Emails a Spatie database backup zip — /platform/settings "Database Backups". */
class DatabaseBackupMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public string $appName,
        public string $backupFilename,
        public string $backupDate,
        public string $backupSize,
        public ?string $customMessage,
        public string $zipBinary,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "{$this->appName} — Database Backup ({$this->backupDate})",
        );
    }

    public function content(): Content
    {
        return new Content(view: 'emails.database-backup');
    }

    public function attachments(): array
    {
        return [
            Attachment::fromData(fn () => $this->zipBinary, $this->backupFilename)
                ->withMime('application/zip'),
        ];
    }
}
