<?php

namespace App\Http\Controllers\Api\Platform;

use App\Http\Controllers\Controller;
use App\Http\Requests\Platform\SaveHeroSlideRequest;
use App\Models\HeroSlide;
use App\Services\AuditService;
use App\Traits\JsonResponse as JsonResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Home page hero slides. Image uploads are multipart, so update() is
 * reached via POST + _method=PUT (same as BrandController).
 */
class HeroSlideController extends Controller
{
    use JsonResponseTrait;

    public function index(): JsonResponse
    {
        return $this->response('Hero slides retrieved', HeroSlide::ordered()->get());
    }

    public function store(SaveHeroSlideRequest $request): JsonResponse
    {
        $data = $request->safe()->except('image');
        $data['image'] = $request->file('image')->store('hero-slides', 'public');
        $data['sort_order'] ??= (int) HeroSlide::max('sort_order') + 1;

        $slide = HeroSlide::create($data);
        AuditService::create('HeroSlide', $slide->id, $slide->title);

        return $this->response('Hero slide created', $slide, 201);
    }

    public function update(SaveHeroSlideRequest $request, HeroSlide $heroSlide): JsonResponse
    {
        $data = $request->safe()->except('image');

        if ($request->hasFile('image')) {
            $heroSlide->deleteImageFile();
            $data['image'] = $request->file('image')->store('hero-slides', 'public');
        }

        $heroSlide->update($data);
        AuditService::edit('HeroSlide', $heroSlide->id, $heroSlide->title);

        return $this->response('Hero slide updated', $heroSlide->fresh());
    }

    /** Body: { ids: [3, 1, 2] } - the full new order. */
    public function reorder(Request $request): JsonResponse
    {
        $ids = $request->validate([
            'ids' => ['required', 'array'],
            'ids.*' => ['integer', 'exists:hero_slides,id'],
        ])['ids'];

        foreach (array_values($ids) as $position => $id) {
            HeroSlide::whereKey($id)->update(['sort_order' => $position]);
        }

        return $this->response('Hero slides reordered', HeroSlide::ordered()->get());
    }

    public function destroy(HeroSlide $heroSlide): JsonResponse
    {
        $heroSlide->deleteImageFile();
        $heroSlide->delete();
        AuditService::delete('HeroSlide', $heroSlide->id, $heroSlide->title);

        return $this->response('Hero slide deleted');
    }
}
