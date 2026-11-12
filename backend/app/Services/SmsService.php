<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Sends an SMS through text.lk (https://text.lk/docs/send-sms/).
 *
 * Every SMS (number, message, sent/failed) is logged to storage/logs/sms/.
 * When TEXTLK_ENABLED=false nothing is sent — only logged, so local dev
 * can read the OTP there.
 */
class SmsService
{
    public function send(string $phone, string $message): bool
    {
        if (! config('services.textlk.enabled')) {
            $this->log('not sent (text.lk disabled)', $phone, $message);

            return true;
        }

        try {
            $response = Http::withToken(config('services.textlk.api_key'))
                ->acceptJson()
                ->timeout(10)
                ->post(rtrim(config('services.textlk.url'), '/') . '/sms/send', [
                    'recipient' => $phone,
                    'sender_id' => config('services.textlk.sender_id'),
                    'type'      => 'plain',
                    'message'   => $message,
                ]);
        } catch (\Throwable $e) {
            $this->log('failed', $phone, $message, $e->getMessage());

            return false;
        }

        if ($response->json('status') !== 'success') {
            $this->log('failed', $phone, $message, $response->body());

            return false;
        }

        $this->log('sent', $phone, $message);

        return true;
    }

    /** One line per SMS in storage/logs/sms/sms-<date>.log */
    private function log(string $status, string $phone, string $message, ?string $error = null): void
    {
        $line = "[{$status}] to {$phone}: {$message}";

        if ($error) {
            Log::channel('sms')->error($line, ['error' => $error]);
        } else {
            Log::channel('sms')->info($line);
        }
    }

    /**
     * Turns 0771234567 / 771234567 / +94 77 123 4567 into 94771234567
     * (the format text.lk wants). Returns null if it isn't a Sri Lankan number.
     */
    public static function formatPhone(?string $phone): ?string
    {
        $digits = preg_replace('/\D/', '', (string) $phone);

        if (strlen($digits) === 10 && $digits[0] === '0') {
            $digits = '94' . substr($digits, 1);
        } elseif (strlen($digits) === 9) {
            $digits = '94' . $digits;
        }

        return preg_match('/^94\d{9}$/', $digits) ? $digits : null;
    }
}
