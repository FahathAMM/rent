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
            // In the visitor's language on the public site; the admin panel never
            // sends X-Locale, so it always gets (and edits) the English text.
            'tagline'    => $this->translate('tagline'),
            'login_eyebrow'     => $this->translate('login_eyebrow'),
            'login_heading'     => $this->translate('login_heading'),
            'login_description' => $this->translate('login_description'),
            'translations'      => $this->translations ?? (object) [],
            'support_email'    => $this->support_email,
            'support_phone'    => $this->support_phone,
            'support_whatsapp' => $this->support_whatsapp,
            'support_address'  => $this->support_address,
            'support_hours'    => $this->support_hours,
            // Off → bookings are paid in cash at pickup; the booking widget and pages word themselves accordingly.
        ];
    }
}
