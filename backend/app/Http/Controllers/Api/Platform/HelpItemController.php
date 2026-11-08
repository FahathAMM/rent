<?php

namespace App\Http\Controllers\Api\Platform;

use App\Http\Controllers\Controller;
use App\Http\Requests\Platform\SaveHelpItemRequest;
use App\Models\HelpItem;
use App\Services\AuditService;
use App\Traits\JsonResponse as JsonResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Stay safe, FAQ, Terms & Conditions and Privacy Policy content, under Help & Support in the platform admin. */
class HelpItemController extends Controller
{
    use JsonResponseTrait;

    public function index(Request $request): JsonResponse
    {
        $type = $request->validate(['type' => ['required', Rule::in(HelpItem::TYPES)]])['type'];

        return $this->response('Help items retrieved', HelpItem::where('type', $type)->ordered()->get());
    }

    public function store(SaveHelpItemRequest $request): JsonResponse
    {
        $data = $request->validated();
        $data['sort_order'] = (int) HelpItem::where('type', $data['type'])->max('sort_order') + 1;

        $item = HelpItem::create($data);
        AuditService::create('HelpItem', $item->id, $item->title);

        return $this->response('Help item created', $item, 201);
    }

    public function update(SaveHelpItemRequest $request, HelpItem $helpItem): JsonResponse
    {
        $helpItem->update($request->validated());
        AuditService::edit('HelpItem', $helpItem->id, $helpItem->title);

        return $this->response('Help item updated', $helpItem->fresh());
    }

    /** Body: { ids: [3, 1, 2] } - the full new order of one type. */
    public function reorder(Request $request): JsonResponse
    {
        $ids = $request->validate([
            'ids' => ['required', 'array'],
            'ids.*' => ['integer', 'exists:help_items,id'],
        ])['ids'];

        foreach (array_values($ids) as $position => $id) {
            HelpItem::whereKey($id)->update(['sort_order' => $position]);
        }

        return $this->response('Help items reordered');
    }

    public function destroy(HelpItem $helpItem): JsonResponse
    {
        $helpItem->delete();
        AuditService::delete('HelpItem', $helpItem->id, $helpItem->title);

        return $this->response('Help item deleted');
    }
}
