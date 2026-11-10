<?php

namespace App\Http\Requests\Platform;

use App\Models\HelpItem;
use App\Services\RentalAgreementService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SaveHelpItemRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    /** Rich text is shown as HTML on the public site, so clean it before validating. */
    protected function prepareForValidation(): void
    {
        if ($this->isRich()) {
            $sanitizer = app(RentalAgreementService::class);
            $this->merge(['body' => $sanitizer->sanitize($this->input('body'))]);

            // Translated bodies are shown as HTML too.
            $translations = $this->input('translations');
            if (is_array($translations)) {
                foreach ($translations as $locale => $fields) {
                    if (is_array($fields) && is_string($fields['body'] ?? null)) {
                        $translations[$locale]['body'] = $sanitizer->sanitize($fields['body']);
                    }
                }
                $this->merge(['translations' => $translations]);
            }
        }
    }

    public function rules(): array
    {
        return [
            'type' => ['required', Rule::in(HelpItem::TYPES)],
            'section' => ['nullable', 'required_if:type,faq,safety_tip', 'string', 'max:120'],
            'title' => ['required', 'string', 'max:255'],
            'body' => ['nullable', 'required_if:type,faq,emergency_contact,terms,privacy', 'string', 'max:' . ($this->isRich() ? 20000 : 5000)],
            'is_active' => ['nullable', 'boolean'],
            ...HelpItem::translationRules(['section' => 'max:120', 'title' => 'max:255', 'body' => 'max:' . ($this->isRich() ? 20000 : 5000)]),
        ];
    }

    private function isRich(): bool
    {
        return in_array($this->input('type'), HelpItem::RICH_TYPES, true);
    }
}
