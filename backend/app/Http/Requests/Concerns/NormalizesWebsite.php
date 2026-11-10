<?php

namespace App\Http\Requests\Concerns;

/**
 * A shop's website is shown as a link on its public page, so only plain
 * http(s) addresses are allowed (never javascript: / data: links). A bare
 * "www.example.com" gets https:// added before validation.
 */
trait NormalizesWebsite
{
    protected function prepareForValidation(): void
    {
        $website = trim((string) $this->input('website'));

        if ($website !== '' && !preg_match('#^[a-z][a-z0-9+.-]*:#i', $website)) {
            $website = 'https://' . ltrim($website, '/');
        }

        if ($this->has('website')) {
            $this->merge(['website' => $website === '' ? null : $website]);
        }
    }

    protected function websiteRules(): array
    {
        return ['nullable', 'string', 'max:255', 'url:http,https'];
    }
}
