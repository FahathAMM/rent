<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class PlatformDetailResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'name'       => $this->name,
            // Same-origin path (Next.js rewrites /storage/* to the backend — see
            // next.config.mjs) rather than an absolute backend URL: the browser
            // already has a warm connection to the frontend origin, so this skips
            // the extra cross-origin connection setup that was delaying the logo
            // on first paint. Every other Resource in the app still uses
            // asset(Storage::url()) deliberately — this one is browser-only.
            'logo'       => $this->logo ? '/storage/' . $this->logo : null,
            'login_logo' => $this->login_logo ? '/storage/' . $this->login_logo : null,
            'tagline'    => $this->tagline,
            'login_eyebrow'     => $this->login_eyebrow,
            'login_heading'     => $this->login_heading,
            'login_description' => $this->login_description,
        ];
    }
}
