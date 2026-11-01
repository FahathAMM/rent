<?php

namespace App\Models;

use App\Models\Administration\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

/**
 * A booking's customer account statement. Each row is one line:
 *  - debit  = the customer owes more: the booking charge and the security
 *             deposit (separate lines) at confirmation, a
 *             price increase, money paid back to them;
 *  - credit = what reduces it: money received (cash at the counter, a bank
 *             transfer verified or recorded by the shop), a price decrease,
 *             the charge reversed on cancellation;
 *  - balance = what is still owed after this line (debits − credits),
 *             negative when the shop owes the customer. Set once the line
 *             takes effect (succeeded) - see settleBalance().
 * Money lines have a method (cash / bank); charge and adjustment lines
 * don't - see scopeMoney(). Gateway columns were removed with online
 * payments - see app-doc/marketplace/09-online-payments-archive.md.
 */
class Payment extends Model
{
    use SoftDeletes;

    /** amount: the line's value either way (debit or credit) - for display; never stored. */
    protected $appends = ['amount'];

    public const METHOD_CASH = 'cash';
    public const METHOD_BANK = 'bank';

    // Statement lines that are not money changing hands.
    public const TYPE_BOOKING_CHARGE = 'booking_charge';
    public const TYPE_ADJUSTMENT = 'adjustment';
    // As a charge line (no method): the deposit owed at confirmation. As a money line: the deposit taken in cash.
    public const TYPE_SECURITY_DEPOSIT = 'security_deposit';

    // pending = transfer receipt waiting for the shop; failed = rejected receipt; cancelled = closed with the booking.
    public const STATUS_PENDING = 'pending';
    public const STATUS_SUCCEEDED = 'succeeded';
    public const STATUS_FAILED = 'failed';
    public const STATUS_CANCELLED = 'cancelled';

    protected $fillable = [
        'booking_id', 'payment_reference', 'type', 'credit', 'debit', 'balance', 'currency', 'status',
        'method', 'paid_at',
        'idempotency_key', 'initiated_by',
        'transfer_reference', 'verified_by', 'verified_at',
    ];

    protected $casts = [
        'credit' => 'decimal:2',
        'debit' => 'decimal:2',
        'balance' => 'decimal:2',
        'paid_at' => 'datetime',
        'verified_at' => 'datetime',
    ];

    public function getAmountAttribute(): string
    {
        return (float) $this->debit > 0 ? (string) $this->debit : (string) $this->credit;
    }

    /** Lines where money actually changed hands (cash / bank) - not charges or price adjustments. */
    public function scopeMoney(Builder $query): Builder
    {
        return $query->whereNotNull('method');
    }

    public function isMoney(): bool
    {
        return $this->method !== null;
    }

    /**
     * Post a charge or adjustment line (no money moves): the booking charge
     * and security deposit at confirmation, a price change, a charge reversed
     * on cancellation.
     */
    public static function postLine(Booking $booking, string $type, float $debit, float $credit, ?int $actorId = null): self
    {
        $line = static::create([
            'booking_id' => $booking->id,
            'payment_reference' => (match ($type) {
                self::TYPE_BOOKING_CHARGE => 'CHG-',
                self::TYPE_SECURITY_DEPOSIT => 'DEP-',
                default => 'ADJ-',
            }) . Str::upper(Str::random(10)),
            'type' => $type,
            'debit' => round($debit, 2),
            'credit' => round($credit, 2),
            'currency' => $booking->pricing?->currency ?? 'LKR',
            'status' => self::STATUS_SUCCEEDED,
            'paid_at' => now(),
            'idempotency_key' => (string) Str::uuid(),
            'initiated_by' => $booking->customer_id,
            'verified_by' => $actorId,
            'verified_at' => $actorId ? now() : null,
        ]);
        $line->settleBalance();

        return $line;
    }

    /**
     * Stamp balance = what is still owed including this line (the booking's
     * succeeded debits − credits). Called the moment a line takes effect: a
     * charge posted, cash taken, a transfer verified, a payment recorded.
     */
    public function settleBalance(): void
    {
        $prior = (float) static::where('booking_id', $this->booking_id)
            ->where('status', self::STATUS_SUCCEEDED)
            ->whereKeyNot($this->id)
            ->selectRaw('COALESCE(SUM(debit - credit), 0) as owed')
            ->value('owed');

        $this->update(['balance' => round($prior + (float) $this->debit - (float) $this->credit, 2)]);
    }

    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    public function initiatedBy(): BelongsTo
    {
        return $this->belongsTo(Customer::class, 'initiated_by');
    }

    /**
     * A booking's lines in statement order: the opening charges first, then
     * by when each took effect (or was uploaded, for a pending receipt).
     *
     * @param  iterable<self>  $payments
     */
    public static function statementOrder(iterable $payments): \Illuminate\Support\Collection
    {
        return collect($payments)->sortBy([
            fn ($a, $b) => self::openingRank($a) <=> self::openingRank($b),
            fn ($a, $b) => ($a->paid_at ?? $a->created_at) <=> ($b->paid_at ?? $b->created_at),
            fn ($a, $b) => $a->id <=> $b->id,
        ])->values();
    }

    /** The opening lines lead the statement: booking charge, then the deposit owed, then everything else. */
    private static function openingRank(self $line): int
    {
        return match (true) {
            $line->type === self::TYPE_BOOKING_CHARGE => 0,
            $line->type === self::TYPE_SECURITY_DEPOSIT && !$line->isMoney() => 1,
            default => 2,
        };
    }

    /** What the customer and shop booking pages show for a statement line. */
    public function summary(): array
    {
        return [
            'id' => $this->id,
            'payment_reference' => $this->payment_reference,
            'method' => $this->method,
            'type' => $this->type,
            'amount' => $this->amount,
            'credit' => $this->credit,
            'debit' => $this->debit,
            'balance' => $this->balance,
            'status' => $this->status,
            'transfer_reference' => $this->transfer_reference,
            'has_proof' => $this->relationLoaded('proof') ? $this->proof !== null : null,
            'paid_at' => $this->paid_at?->toISOString(),
            'verified_at' => $this->verified_at?->toISOString(),
            'created_at' => $this->created_at?->toISOString(),
        ];
    }

    public function verifiedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'verified_by');
    }

    /** The uploaded transfer receipt (PDF or image) - bank_transfer payments only. */
    public function proof(): MorphOne
    {
        return $this->morphOne(Attachment::class, 'attachable')->where('document_type', 'transfer_proof');
    }
}
