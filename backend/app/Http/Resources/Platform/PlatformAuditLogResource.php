<?php

namespace App\Http\Resources\Platform;

use Illuminate\Http\Resources\Json\JsonResource;

/** A system/security audit trail entry (create/update/delete/login/impersonation/...) — never a CRM activity. */
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
            'old_values'  => $this->old_values,
            'new_values'  => $this->new_values,
            'ip'          => $this->ip,
            'browser'     => $this->browser,
            'created_at'  => $this->created_at?->toISOString(),
            'company'     => $this->whenLoaded('company', fn () => $this->company ? [
                'id'   => $this->company->id,
                'name' => $this->company->name,
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
