<?php

namespace App\Http\Controllers\Api\Public;

use App\Http\Controllers\Controller;
use App\Models\HelpItem;
use Illuminate\Http\JsonResponse;

/** Active Stay safe, FAQ, Terms & Conditions and Privacy Policy content, in display order. */
class HelpItemController extends Controller
{
    public function index(): JsonResponse
    {
        $items = HelpItem::where('is_active', true)->ordered()->get(['id', 'type', 'section', 'title', 'body']);

        return response()->json(['data' => $items]);
    }
}
