<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Administration\User;
use App\Models\Customer;
use App\Models\PublicVisit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class VisitLogController extends Controller
{
    private const TYPES = [PublicVisit::TYPE_PUBLIC, PublicVisit::TYPE_VENDOR, 'site_visit', 'linkedin_click', 'website_click'];

    /**
     * Simple traffic log — public page visits, vendor app page visits,
     * login-page visits and footer link clicks — one file per day:
     * storage/logs/public_visit/YYYY-MM-DD.log.
     * Public and vendor page visits are also saved to the public_visits table.
     */
    public function track(Request $request): JsonResponse
    {
        $type = in_array($request->string('type')->toString(), self::TYPES, true)
            ? $request->string('type')->toString()
            : PublicVisit::TYPE_PUBLIC;

        // X-Real-IP only counts when it was set by one of our own proxies — a visitor could send anything.
        $ip = ($request->isFromTrustedProxy() ? $request->header('X-Real-IP') : null) ?: $request->ip();

        // The route is public — whichever token is sent is read: a customer's
        // (public pages) or a vendor owner/staff member's (vendor app pages).
        // A guest, or a bad/expired token, leaves both blank.
        $customer = auth('customer')->user();
        $customer = $customer instanceof Customer ? $customer : null;
        $user = auth('sanctum')->user();
        $user = $user instanceof User ? $user : null;
        $shop = $user?->shop;

        $fields = array_merge([
            'type' => $type,
            'path' => $this->clean($request->input('path'), 500),
            'customer_id' => $customer?->id,
            'customer_name' => $customer?->name,
            'user_id' => $user?->id,
            'user_name' => $user?->name,
            'shop_id' => $shop?->id,
            'shop_name' => $shop?->name,
            'ip' => $ip,
        ], $this->geo($ip), [
            'user_agent' => $this->clean($request->userAgent(), 500),
        ]);

        // Pipe-separated plain text — easy to read and tail.
        $line = collect($fields)->except('type')->map(fn ($value, $key) => "{$key}: " . ($value ?? '-'))->implode(' | ');

        // One file per day.
        $date = now()->toDateString();

        Log::build([
            'driver' => 'single',
            'path' => config('logging.public_visit_path') . "/{$date}.log",
        ])->info("{$type} | {$line}");

        // Public and vendor page visits are also kept in the database for /platform/visits.
        if (in_array($type, PublicVisit::STORED_TYPES, true)) {
            PublicVisit::create($fields);
        }

        return response()->json(['status' => true]);
    }

    /**
     * Visitor-supplied text (page path, User-Agent) on one line: control
     * characters are dropped so a value can't start a forged line in the log
     * file, and pipes so it can't fake another field.
     */
    private function clean(mixed $value, int $max): ?string
    {
        if (!is_string($value)) {
            return null;
        }

        $value = trim(str_replace('|', '/', preg_replace('/[\x00-\x1F\x7F]+/u', ' ', $value) ?? ''));

        return $value === '' ? null : mb_substr($value, 0, $max);
    }

    /**
     * Best-effort IP geolocation via ip-api.com's free tier (no API key).
     * Skipped for local/private IPs; any failure just logs without geo data.
     * Remembered per IP for a day, so repeat visits (or someone hammering this
     * public route) don't each hold a request open on an outside lookup.
     */
    private function geo(?string $ip): array
    {
        $empty = ['country' => null, 'city' => null, 'isp' => null, 'timezone' => null];

        if (!$ip || !filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
            return $empty;
        }

        $key = 'visit-geo:' . $ip;
        $cached = Cache::get($key);
        if (is_array($cached)) {
            return $cached;
        }

        $geo = $empty;
        $found = false;

        try {
            $res = Http::timeout(2)->get("http://ip-api.com/json/{$ip}", [
                'fields' => 'status,country,city,isp,timezone',
            ]);

            if ($res->ok() && $res->json('status') === 'success') {
                $found = true;
                $geo = [
                    'country' => $this->clean($res->json('country'), 100),
                    'city' => $this->clean($res->json('city'), 100),
                    'isp' => $this->clean($res->json('isp'), 150),
                    'timezone' => $this->clean($res->json('timezone'), 64),
                ];
            }
        } catch (\Throwable $e) {
            // Best-effort only.
        }

        // A failed lookup is retried after a few minutes rather than on every visit.
        Cache::put($key, $geo, $found ? now()->addDay() : now()->addMinutes(10));

        return $geo;
    }
}
