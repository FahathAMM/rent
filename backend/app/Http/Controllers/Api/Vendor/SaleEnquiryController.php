<?php

namespace App\Http\Controllers\Api\Vendor;

use App\Http\Controllers\Controller;
use App\Http\Resources\SaleEnquiryResource;
use App\Models\SaleEnquiry;
use App\Services\AuthUser;
use App\Services\SaleEnquiryService;
use App\Traits\JsonResponse as JsonResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** The shop's enquiry inbox. SaleEnquiry is shop-scoped, so another shop's {enquiry} is a 404. */
class SaleEnquiryController extends Controller
{
    use JsonResponseTrait;

    public function __construct(private SaleEnquiryService $service)
    {
        $this->middleware('can:vendor-sales-enquiries-view')->only(['index', 'show']);
        $this->middleware('can:vendor-sales-enquiries-edit')->only(['reply', 'close']);
    }

    public function index(Request $request): JsonResponse
    {
        $enquiries = SaleEnquiry::with(['customer:id,name,email,phone', 'vehicle.saleDetail'])
            ->withCount(['messages as unread_count' => fn ($q) => $q->where('sender_type', SaleEnquiry::SENDER_CUSTOMER)->whereNull('read_at')])
            ->when($request->status, fn ($q) => $q->where('status', $request->status))
            ->when($request->search, fn ($q) => $q->where(fn ($s) => $s
                ->where('reference', 'like', "%{$request->search}%")
                ->orWhereHas('customer', fn ($c) => $c->where('name', 'like', "%{$request->search}%"))
                ->orWhereHas('vehicle', fn ($v) => $v->where('title', 'like', "%{$request->search}%"))))
            ->orderByDesc('last_message_at')
            ->paginate(min((int) $request->get('perPage', 20), 100));

        $enquiries->through(fn ($enquiry) => (new SaleEnquiryResource($enquiry))->resolve());

        return response()->json(['record' => $enquiries, 'message' => 'Enquiries retrieved', 'status' => true]);
    }

    public function show(SaleEnquiry $enquiry): JsonResponse
    {
        $this->service->markRead($enquiry, SaleEnquiry::SENDER_SHOP);

        return $this->response('Enquiry retrieved', new SaleEnquiryResource($this->loaded($enquiry)));
    }

    public function reply(Request $request, SaleEnquiry $enquiry): JsonResponse
    {
        $body = $request->validate(['body' => ['required', 'string', 'max:5000']])['body'];
        $this->service->shopReply($enquiry, AuthUser::user(), $body);

        return $this->response('Reply sent', new SaleEnquiryResource($this->loaded($enquiry)));
    }

    public function close(Request $request, SaleEnquiry $enquiry): JsonResponse
    {
        $reason = $request->validate(['reason' => ['nullable', 'string', 'max:255']])['reason'] ?? null;
        $this->service->close($enquiry, $reason ?: 'Closed by the shop');

        return $this->response('Enquiry closed', new SaleEnquiryResource($this->loaded($enquiry)));
    }

    private function loaded(SaleEnquiry $enquiry): SaleEnquiry
    {
        return $enquiry->load(['customer:id,name,email,phone', 'vehicle.saleDetail', 'vehicle.images.attachment', 'messages' => fn ($q) => $q->orderBy('created_at')->orderBy('id')]);
    }
}
