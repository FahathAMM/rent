<?php

namespace App\Services;

use App\Models\Administration\User;
use App\Models\SystemAdmin;
use Illuminate\Validation\ValidationException;

/**
 * Platform admin management of any marketplace account (customer, owner,
 * or staff — there is no separate "customer" table, see User's
 * docblock). AuthService::login already blocks a suspended/banned user
 * from getting a new token; suspend() here additionally revokes every
 * token the user already holds, so an existing session dies immediately
 * rather than staying valid until it naturally expires.
 */
class CustomerService
{
    public function suspend(SystemAdmin $admin, User $user, string $reason): User
    {
        if ($user->status === User::STATUS_SUSPENDED) {
            throw ValidationException::withMessages(['status' => ['This account is already suspended.']]);
        }

        $user->update([
            'status' => User::STATUS_SUSPENDED,
            'suspended_reason' => $reason,
            'suspended_at' => now(),
        ]);

        $user->tokens()->delete();

        AuditService::edit('User', $user->id, $user->name, null, ['status' => 'suspended', 'reason' => $reason, 'decided_by_admin_id' => $admin->id]);

        return $user->fresh();
    }

    public function ban(SystemAdmin $admin, User $user, string $reason): User
    {
        $user->update([
            'status' => User::STATUS_BANNED,
            'suspended_reason' => $reason,
            'suspended_at' => now(),
        ]);

        $user->tokens()->delete();

        AuditService::edit('User', $user->id, $user->name, null, ['status' => 'banned', 'reason' => $reason, 'decided_by_admin_id' => $admin->id]);

        return $user->fresh();
    }

    public function activate(SystemAdmin $admin, User $user): User
    {
        $user->update([
            'status' => User::STATUS_ACTIVE,
            'suspended_reason' => null,
            'suspended_at' => null,
        ]);

        AuditService::edit('User', $user->id, $user->name, null, ['status' => 'active', 'decided_by_admin_id' => $admin->id]);

        return $user->fresh();
    }
}
