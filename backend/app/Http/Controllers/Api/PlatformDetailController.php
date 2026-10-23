<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Platform\UpdatePlatformDetailRequest;
use App\Http\Resources\PlatformDetailResource;
use App\Models\PlatformDetail;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Storage;

/** Platform-wide branding (name/logo/tagline) shown in every tenant's app sidebar. */
class PlatformDetailController extends Controller
{
    public function show(): JsonResponse
    {
        return response()->json(['data' => new PlatformDetailResource(PlatformDetail::current())]);
    }

    public function update(UpdatePlatformDetailRequest $request): JsonResponse
    {
        $detail = PlatformDetail::current();

        $data = $request->validated();
        unset($data['logo'], $data['login_logo']);

        if ($request->hasFile('logo')) {
            if ($detail->logo) {
                Storage::disk('public')->delete($detail->logo);
            }
            $data['logo'] = $request->file('logo')->store('platform-logos', 'public');
        }

        if ($request->hasFile('login_logo')) {
            if ($detail->login_logo) {
                Storage::disk('public')->delete($detail->login_logo);
            }
            $data['login_logo'] = $request->file('login_logo')->store('platform-logos', 'public');
        }

        $detail->update($data);

        return response()->json([
            'message' => 'Platform branding updated successfully',
            'data'    => new PlatformDetailResource($detail->fresh()),
        ]);
    }
}
