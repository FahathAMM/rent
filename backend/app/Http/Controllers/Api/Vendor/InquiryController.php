<?php

namespace App\Http\Controllers\Api\Vendor;

use App\Http\Controllers\Controller;
use App\Http\Requests\Vendor\ReplyInquiryRequest;
use App\Models\VehicleInquiry;
use App\Services\AuthUser;
use App\Services\InquiryService;
use App\Support\VendorContext;
use App\Traits\JsonResponse as JsonResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** VehicleInquiry has no BelongsToShop/ShopScope, so shop_id is filtered explicitly here, same as Review. */
class InquiryController extends Controller
{
    use JsonResponseTrait;

    public function __construct(private InquiryService $service) {}

    public function index(Request $request): JsonResponse
    {
        $inquiries = VehicleInquiry::where('shop_id', VendorContext::shopId())
            ->when($request->status, fn ($q) => $q->where('status', $request->status))
            ->with('vehicle:id,title')
            ->orderByDesc('created_at')
            ->paginate(min((int) $request->get('perPage', 20), 100));

        return response()->json(['record' => $inquiries, 'message' => 'Inquiries retrieved', 'status' => true]);
    }

    public function reply(ReplyInquiryRequest $request, VehicleInquiry $inquiry): JsonResponse
    {
        abort_unless($inquiry->shop_id === VendorContext::shopId(), 404);

        $inquiry = $this->service->reply(AuthUser::user(), $inquiry, $request->validated('reply_message'));

        return $this->response('Reply sent', $inquiry);
    }
}
