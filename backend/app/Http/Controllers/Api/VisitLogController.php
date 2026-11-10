<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\PublicVisit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class VisitLogController extends Controller
{
    private const TYPES = ['public_visit', 'site_visit', 'linkedin_click', 'website_click'];

    /**
     * Simple traffic log — public page visits, login-page visits and footer
     * link clicks — one file per day: storage/logs/public_visit/YYYY-MM-DD.log.
     * Public page visits are also saved to the public_visits table.
     */
    public function track(Request $request): JsonResponse
    {
        $type = in_array($request->string('type')->toString(), self::TYPES, true)
            ? $request->string('type')->toString()
            : 'public_visit';

        // X-Real-IP only counts when it was set by one of our own proxies — a visitor could send anything.
        $ip = ($request->isFromTrustedProxy() ? $request->header('X-Real-IP') : null) ?: $request->ip();

        // The route is public — a signed-in customer's token is read if sent,
        // otherwise (guest, bad/expired token) both stay blank.
        $customer = auth('customer')->user();
        $customer = $customer instanceof Customer ? $customer : null;

        $fields = array_merge([
            'path' => mb_substr($request->string('path')->toString(), 0, 500) ?: null,
            'customer_id' => $customer?->id,
            'customer_name' => $customer?->name,
            'ip' => $ip,
        ], $this->geo($ip), [
            'user_agent' => $request->userAgent(),
        ]);

        // Pipe-separated plain text — easy to read and tail.
        $line = collect($fields)->map(fn ($value, $key) => "{$key}: " . ($value ?? '-'))->implode(' | ');

        // One file per day.
        $date = now()->toDateString();

        Log::build([
            'driver' => 'single',
            'path' => config('logging.public_visit_path') . "/{$date}.log",
        ])->info("{$type} | {$line}");

        // Public page visits are also kept in the database for /platform/visits.
        if ($type === 'public_visit') {
            PublicVisit::create($fields);
        }

        return response()->json(['status' => true]);
    }

    /**
     * Best-effort IP geolocation via ip-api.com's free tier (no API key).
     * Skipped for local/private IPs; any failure just logs without geo data.
     */
    private function geo(?string $ip): array
    {
        $empty = ['country' => null, 'city' => null, 'isp' => null, 'timezone' => null];

        if (!$ip || !filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
            return $empty;
        }

        try {
            $res = Http::timeout(2)->get("http://ip-api.com/json/{$ip}", [
                'fields' => 'status,country,city,isp,timezone',
            ]);

            if ($res->ok() && $res->json('status') === 'success') {
                return [
                    'country' => $res->json('country'),
                    'city' => $res->json('city'),
                    'isp' => $res->json('isp'),
                    'timezone' => $res->json('timezone'),
                ];
            }
        } catch (\Throwable $e) {
            // Best-effort only.
        }

        return $empty;
    }
}
