<?php

namespace App\Traits;

trait JsonResponse
{
    /**
     * Build a standard {message, data} JSON response, matching the shape
     * every controller/hook in this app already expects.
     */
    public function response(?string $message = null, mixed $data = null, int $status = 200, array $meta = [])
    {
        $payload = ['message' => $message, 'data' => $data];

        if (!empty($meta)) {
            $payload['meta'] = $meta;
        }

        return response()->json($payload, $status);
    }
}
