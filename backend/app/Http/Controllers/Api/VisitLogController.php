<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class VisitLogController extends Controller
{
    /**
     * Simple traffic log — website visits and pricing-plan previews — kept
     * in its own log file, not the database. No model/table on purpose.
     */
    public function track(Request $request): JsonResponse
    {
        $type = in_array($request->string('type'), ['site_visit', 'pricing_view', 'linkedin_click', 'website_click'])
            ? $request->string('type')->toString()
            : 'site_visit';

       $orgIp = $request->ip();

        $ip = $request->header('X-Real-IP') ?: $request->ip();

        $fields = array_merge([
            'path' => $request->string('path')->toString() ?: null,
            'ip' => $ip,
            'org_ip' => $orgIp,
        ], $this->geo($ip), [
            'user_agent' => $request->userAgent(),
        ]);

        // Pipe-separated plain text instead of Monolog's default JSON
        // context blob — easier to eyeball/tail than a wall of JSON.
        $line = collect($fields)->map(fn ($value, $key) => "{$key}: " . ($value ?? '-'))->implode(' | ');

        Log::build([
            'driver' => 'single',
            'path' => storage_path('logs/visits.log'),
        ])->info("{$type} | {$line}");

        return response()->json(['status' => true]);
    }

    /**
     * Best-effort IP geolocation via ip-api.com's free tier — no signup/API
     * key, so nothing to configure. Skipped for local/private IPs (nothing
     * to look up) and swallows any failure — a geo miss should never stop
     * the visit itself from being logged.
     */
    private function geo(?string $ip): array
    {

        Log::info('IP Debug', [
            'ip' => request()->ip(),
            'ips' => request()->ips(),
            'x_forwarded_for' => request()->header('X-Forwarded-For'),
            'x_real_ip' => request()->header('X-Real-IP'),
            ]);
        
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
            // Best-effort only — ignore and log without geo data.
        }
        return $empty;
    }
}
