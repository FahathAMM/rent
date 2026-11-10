<?php

namespace App\Http\Controllers\Api\Customer;

use App\Http\Controllers\Controller;
use App\Http\Resources\SaleEnquiryResource;
use App\Models\SaleEnquiry;
use App\Queries\CustomerSaleQuery;
use App\Repositories\PublicSaleRepo;
use App\Services\SaleAgreementService;
use App\Services\SaleEnquiryService;
use App\Traits\JsonResponse as JsonResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** A buyer's own enquiries — ownership by customer_id through CustomerSaleQuery, never route-model binding. */
class SaleEnquiryController extends Controller
{
    use JsonResponseTrait;

    public function __construct(private SaleEnquiryService $service) {}

    public function index(Request $request): JsonResponse
    {
        // ?status=open|closed — the inbox tabs; anything else lists all.
        $status = $request->get('status');

        $enquiries = CustomerSaleQuery::forCustomer($request->user('customer')->id)
            ->when($status === 'open', fn ($q) => $q->open())
            ->when($status === 'closed', fn ($q) => $q->whereNotIn('sale_enquiries.status', SaleEnquiry::OPEN_STATUSES))
            ->orderByDesc('last_message_at')
            ->paginate(min((int) $request->get('per_page', 10), 50));
        $enquiries->through(fn ($enquiry) => (new SaleEnquiryResource($enquiry))->resolve());

        return response()->json(['record' => $enquiries, 'message' => 'Enquiries retrieved', 'status' => true]);
    }

    public function store(Request $request, PublicSaleRepo $sales): JsonResponse
    {
        $data = $request->validate([
            'vehicle_slug' => ['required', 'string', 'max:255'],
            'body' => ['required', 'string', 'max:5000'],
        ]);

        $customer = $request->user('customer');
        $enquiry = $this->service->open($customer, $sales->findBySlugOrFail($data['vehicle_slug']), $data['body']);

        return $this->response(__('Your enquiry has been sent to the shop'), ['reference' => $enquiry->reference], 201);
    }

    public function show(Request $request, string $reference): JsonResponse
    {
        $enquiry = $this->find($request, $reference);
        $this->service->markRead($enquiry, SaleEnquiry::SENDER_CUSTOMER);

        return $this->response('Enquiry retrieved', new SaleEnquiryResource($this->withMessages($enquiry)));
    }

    public function reply(Request $request, string $reference): JsonResponse
    {
        $enquiry = $this->find($request, $reference);
        $body = $request->validate(['body' => ['required', 'string', 'max:5000']])['body'];
        $this->service->customerReply($enquiry, $request->user('customer'), $body);

        return $this->response(__('Message sent'), new SaleEnquiryResource($this->withMessages($enquiry)));
    }

    public function close(Request $request, string $reference): JsonResponse
    {
        $enquiry = $this->find($request, $reference);
        $this->service->close($enquiry, 'Closed by the buyer');

        return $this->response(__('Enquiry closed'), new SaleEnquiryResource($this->withMessages($enquiry)));
    }

    /** The buyer's copy of the sale agreement — only on the enquiry that became the sale. */
    public function agreement(Request $request, string $reference, SaleAgreementService $agreements): Response
    {
        $enquiry = $this->find($request, $reference);
        $sale = $enquiry->sale;
        abort_unless($sale, 404);

        // The enquiry's vehicle was loaded past ShopScope; the sale's own relation wouldn't be.
        $pdf = $agreements->pdf($sale->setRelation('vehicle', $enquiry->vehicle));
        $filename = "{$sale->reference}.pdf";

        return $request->boolean('download') ? $pdf->download($filename) : $pdf->stream($filename);
    }

    private function find(Request $request, string $reference): SaleEnquiry
    {
        $enquiry = CustomerSaleQuery::find($request->user('customer')->id, $reference);
        abort_unless($enquiry, 404);

        return $enquiry;
    }

    private function withMessages(SaleEnquiry $enquiry): SaleEnquiry
    {
        return $enquiry->load(['messages' => fn ($q) => $q->orderBy('created_at')->orderBy('id')]);
    }
}
