<?php

namespace App\Http\Resources\Platform;

use Illuminate\Http\Resources\Json\JsonResource;

/** A system/security audit trail entry (create/update/delete/approve/suspend/impersonation/...). */
class PlatformAuditLogResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id'          => $this->id,
            'action'      => $this->action,
            'form'        => $this->form,
            'record_id'   => $this->record_id,
            'record'      => $this->record,
            'before'      => $this->before,
            'after'       => $this->after,
            'severity'    => $this->severity,
            'ip'          => $this->ip,
            'browser'     => $this->browser,
            'created_at'  => $this->created_at?->toISOString(),
            'shop'        => $this->whenLoaded('shop', fn () => $this->shop ? [
                'id'   => $this->shop->id,
                'name' => $this->shop->name,
            ] : null),
            'user'        => $this->whenLoaded('user', fn () => $this->user ? [
                'id'    => $this->user->id,
                'name'  => $this->user->name,
                'email' => $this->user->email,
            ] : null),
            'system_admin' => $this->whenLoaded('systemAdmin', fn () => $this->systemAdmin ? [
                'id'   => $this->systemAdmin->id,
                'name' => $this->systemAdmin->name,
            ] : null),
        ];
    }
}
