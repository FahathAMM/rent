<?php

namespace App\Http\Controllers\Api\Platform;

use App\Http\Controllers\Controller;
use App\Http\Requests\Platform\UpdateSupportContactRequest;
use App\Http\Resources\PlatformDetailResource;
use App\Models\PlatformDetail;
use App\Services\AuditService;
use App\Traits\JsonResponse as JsonResponseTrait;
use Illuminate\Http\JsonResponse;

/** The support details on the public Contact us page. The public site reads them from /platform-details. */
class SupportContactController extends Controller
{
    use JsonResponseTrait;

    public function update(UpdateSupportContactRequest $request): JsonResponse
    {
        $detail = PlatformDetail::current();
        $detail->update($request->validated());
        AuditService::edit('PlatformDetail', $detail->id, 'Support contact details');

        return $this->response('Contact details updated', new PlatformDetailResource($detail->fresh()));
    }
}
