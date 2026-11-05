<?php

namespace App\Http\Controllers\Api\Platform;

use App\Http\Controllers\Controller;
use App\Models\PublicVisit;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Public site visits — /platform/visits.
 */
class PublicVisitController extends Controller
{
    /** Totals for the cards at the top of the page, plus the most visited pages. */
    public function summary(): JsonResponse
    {
        $today = $this->localDay();
        $count = fn (CarbonImmutable $from) => PublicVisit::where('created_at', '>=', $from)->count();

        return response()->json(['data' => [
            'today'           => $count($today),
            'unique_today'    => PublicVisit::where('created_at', '>=', $today)->distinct('ip')->count('ip'),
            'last_7_days'     => $count($today->subDays(6)),
            'last_30_days'    => $count($today->subDays(29)),
            'top_pages'       => PublicVisit::where('created_at', '>=', $today->subDays(29))
                ->selectRaw('path, count(*) as visits')
                ->groupBy('path')->orderByDesc('visits')->limit(5)->get(),
        ]]);
    }

    /** {record, message, status} — ServerDataTable's shape. Filters: search (path/ip/country/city), date_from, date_to. */
    public function index(Request $request): JsonResponse
    {
        $query = PublicVisit::query()
            ->when($request->get('search'), fn ($q, $search) => $q->where(fn ($w) => $w
                ->where('path', 'like', "%{$search}%")
                ->orWhere('ip', 'like', "%{$search}%")
                ->orWhere('country', 'like', "%{$search}%")
                ->orWhere('city', 'like', "%{$search}%")))
            ->when($request->get('date_from'), fn ($q, $from) => $q->where('created_at', '>=', $this->localDay($from)))
            ->when($request->get('date_to'), fn ($q, $to) => $q->where('created_at', '<', $this->localDay($to)->addDay()));

        $sortable = ['created_at', 'path', 'country'];
        $sort = in_array($request->get('sort_field'), $sortable, true) ? $request->get('sort_field') : 'created_at';
        $query->orderBy($sort, $request->get('sort_direction') === 'asc' ? 'asc' : 'desc');

        return response()->json([
            'record'  => $query->paginate(min((int) $request->get('perPage', 20), 100)),
            'message' => 'Visits retrieved successfully',
            'status'  => true,
        ]);
    }

    /** Start of a day — today, or the given Y-m-d. */
    private function localDay(?string $date = null): CarbonImmutable
    {
        return ($date ? CarbonImmutable::parse($date) : CarbonImmutable::now())->startOfDay();
    }
}
