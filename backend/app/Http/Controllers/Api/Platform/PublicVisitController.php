<?php

namespace App\Http\Controllers\Api\Platform;

use App\Http\Controllers\Controller;
use App\Models\PublicVisit;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Page visits — /platform/visits. Public site visits (guests/customers)
 * and vendor app visits (owners/staff) share the table; `type` narrows to
 * one of them (public_visit | vendor_visit), for both the list and the summary.
 */
class PublicVisitController extends Controller
{
    /** Totals for the cards at the top of the page, plus the most visited pages. */
    public function summary(Request $request): JsonResponse
    {
        $today = $this->localDay();
        $base = fn () => $this->ofType(PublicVisit::query(), $request->get('type'));
        $count = fn (CarbonImmutable $from) => $base()->where('created_at', '>=', $from)->count();
        $topPages = fn (Builder $query) => $query->where('created_at', '>=', $today->subDays(29))
            ->selectRaw('path, count(*) as visits')
            ->groupBy('path')->orderByDesc('visits')->limit(10)->get();

        return response()->json(['data' => [
            'today'           => $count($today),
            'unique_today'    => $base()->where('created_at', '>=', $today)->distinct('ip')->count('ip'),
            'last_7_days'     => $count($today->subDays(6)),
            'last_30_days'    => $count($today->subDays(29)),
            'top_pages'       => $topPages($base()),
            // Public site and vendor app pages kept apart, so one never crowds the other out of the list.
            'top_pages_by_type' => collect(PublicVisit::STORED_TYPES)
                ->mapWithKeys(fn (string $t) => [$t => $topPages($this->ofType(PublicVisit::query(), $t))]),
        ]]);
    }

    /**
     * {record, message, status} — ServerDataTable's shape.
     * Filters: type, search (path/ip/country/city/customer, user or shop name), date_from, date_to.
     */
    public function index(Request $request): JsonResponse
    {
        $query = $this->ofType(PublicVisit::query(), $request->get('type'))
            ->when($request->get('search'), fn ($q, $search) => $q->where(fn ($w) => $w
                ->where('path', 'like', "%{$search}%")
                ->orWhere('ip', 'like', "%{$search}%")
                ->orWhere('country', 'like', "%{$search}%")
                ->orWhere('city', 'like', "%{$search}%")
                ->orWhere('customer_name', 'like', "%{$search}%")
                ->orWhere('user_name', 'like', "%{$search}%")
                ->orWhere('shop_name', 'like', "%{$search}%")))
            ->when($request->get('date_from'), fn ($q, $from) => $q->where('created_at', '>=', $this->localDay($from)))
            ->when($request->get('date_to'), fn ($q, $to) => $q->where('created_at', '<', $this->localDay($to)->addDay()));

        $sortable = ['created_at', 'path', 'country', 'type'];
        $sort = in_array($request->get('sort_field'), $sortable, true) ? $request->get('sort_field') : 'created_at';
        $query->orderBy($sort, $request->get('sort_direction') === 'asc' ? 'asc' : 'desc');

        return response()->json([
            'record'  => $query->paginate(min((int) $request->get('perPage', 20), 100)),
            'message' => 'Visits retrieved successfully',
            'status'  => true,
        ]);
    }

    /** Narrow to one visit type when a known one is asked for; anything else means all. */
    private function ofType(Builder $query, ?string $type): Builder
    {
        return $query->when(in_array($type, PublicVisit::STORED_TYPES, true), fn ($q) => $q->where('type', $type));
    }

    /** Start of a day — today, or the given Y-m-d. */
    private function localDay(?string $date = null): CarbonImmutable
    {
        return ($date ? CarbonImmutable::parse($date) : CarbonImmutable::now())->startOfDay();
    }
}
