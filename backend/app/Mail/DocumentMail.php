<?php

namespace App\Mail;

use App\Models\Company;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * Emails a quotation or invoice PDF to a customer — shared by both since
 * they only differ in a handful of labels (spec-consistent with
 * PdfDocumentData, which unifies the PDF itself the same way).
 */
class DocumentMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public Company $company,
        public string $docTitle,
        public string $docNumber,
        public float $total,
        public string $currency,
        public ?string $customMessage,
        public string $pdfBinary,
        public string $pdfFilename,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "{$this->docTitle} {$this->docNumber} from {$this->company->name}",
        );
    }

    public function content(): Content
    {
        return new Content(view: 'emails.document');
    }

    public function attachments(): array
    {
        return [
            Attachment::fromData(fn () => $this->pdfBinary, $this->pdfFilename)
                ->withMime('application/pdf'),
        ];
    }
}
