<?php

namespace App\Http\Requests\Platform;

use App\Models\Automation;
use Illuminate\Foundation\Http\FormRequest;

class UpdateAutomationRequest extends FormRequest
{
    public function authorize(): bool { return true; }

    public function rules(): array
    {
        return [
            'name'     => 'required|string|max:255',
            // Comma-separated — a task can run on more than one cadence,
            // e.g. "everyTenMinutes,hourly". Automation::validateIntervalList
            // checks every piece against INTERVALS/FIXED_TIME, non-empty, no dupes.
            'interval' => ['required', 'string', function ($attribute, $value, $fail) {
                if ($error = Automation::validateIntervalList($value)) {
                    $fail($error);
                }
            }],
            // Required whenever the list includes 'fixed_time' — that mode needs a time-of-day to run at.
            // A plain required_if can't express "list contains", since interval may be combined (e.g. "hourly,fixed_time").
            'fixed_time' => [
                function ($attribute, $value, $fail) {
                    $intervals = array_map('trim', explode(',', (string) $this->input('interval')));
                    if (in_array(Automation::FIXED_TIME, $intervals, true) && !$value) {
                        $fail('The fixed time field is required when "Fixed time" is one of the selected intervals.');
                    }
                },
                'nullable',
                'date_format:H:i',
            ],
            'is_active' => 'sometimes|boolean',
        ];
    }
}
