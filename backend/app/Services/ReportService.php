<?php

namespace App\Services;

use App\Models\Administration\User;
use App\Models\Report;
use App\Models\Review;
use App\Models\RentalShop;
use App\Models\SystemAdmin;
use App\Models\Vehicle;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Abuse / fraud reporting against any reportable entity. reportable_type
 * is never the client's raw morph class string - only this fixed
 * allow-list, so a report can never be attached to an arbitrary model.
 * Existence is checked with a plain table lookup rather than an Eloquent
 * find(), which sidesteps ShopScope entirely instead of needing a bypass
 * for it - see tests/Feature/PublicScopeBoundaryTest.php.
 */
class ReportService
{
    private const TYPES = [
        'vehicle' => [Vehicle::class, 'vehicles'],
        'review' => [Review::class, 'reviews'],
        'shop' => [RentalShop::class, 'rental_shops'],
        'user' => [User::class, 'users'],
    ];

    public function create(?User $user, ?string $reporterEmail, string $type, int $reportableId, string $reason, ?string $description): Report
    {
        if (!isset(self::TYPES[$type])) {
            throw ValidationException::withMessages(['reportable_type' => ['Unsupported report target.']]);
        }

        [$modelClass, $table] = self::TYPES[$type];

        if (!DB::table($table)->where('id', $reportableId)->exists()) {
            throw ValidationException::withMessages(['reportable_id' => ['The reported item was not found.']]);
        }

        return Report::create([
            'reportable_type' => $modelClass,
            'reportable_id' => $reportableId,
            'reported_by_user_id' => $user?->id,
            'reporter_email' => $user ? null : $reporterEmail,
            'reason' => $reason,
            'description' => $description,
            'status' => Report::STATUS_NEW,
        ]);
    }

    public function action(SystemAdmin $admin, Report $report, string $status, ?string $actionTaken, ?string $internalNote): Report
    {
        $report->update([
            'status' => $status,
            'reviewed_by' => $admin->id,
            'reviewed_at' => now(),
            'action_taken' => $actionTaken,
            'internal_note' => $internalNote,
        ]);

        return $report->fresh();
    }
}
