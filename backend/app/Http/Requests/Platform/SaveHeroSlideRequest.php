<?php

namespace App\Http\Requests\Platform;

use Illuminate\Foundation\Http\FormRequest;

/** Create + update. The image is required only when creating; on update it's an optional replacement. */
class SaveHeroSlideRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        $creating = !$this->route('heroSlide');

        return [
            'title' => ['required', 'string', 'max:120'],
            'subtitle' => ['nullable', 'string', 'max:255'],
            'image' => [$creating ? 'required' : 'nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
            // A site path ("/browse?...") or an http(s) URL - never javascript: or any other scheme.
            'link_url' => ['nullable', 'string', 'max:255', 'regex:#^(/(?!/)|https?://)#i'],
            'link_label' => ['nullable', 'string', 'max:40'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['nullable', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return ['link_url.regex' => 'The link must be a site path starting with "/" or a full http(s) URL.'];
    }
}
