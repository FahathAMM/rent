<?php

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Controller;
use App\Models\HeroSlide;
use Illuminate\Http\JsonResponse;

/** Active home page hero slides, in display order. */
class HeroSlideController extends Controller
{
    public function index(): JsonResponse
    {
        $slides = HeroSlide::where('is_active', true)->ordered()->get()
            ->map(fn (HeroSlide $s) => [
                'id' => $s->id,
                'title' => $s->translate('title'),
                'subtitle' => $s->translate('subtitle'),
                'image_url' => $s->image_url,
                'link_url' => $s->link_url,
                'link_label' => $s->translate('link_label'),
            ]);

        return response()->json(['data' => $slides]);
    }
}
