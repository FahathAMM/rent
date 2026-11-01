<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\SystemAdmin;
use Illuminate\Validation\ValidationException;

/**
 * Platform admin management of customer accounts (the `customers` table /
 * customer guard — vendor `users` are a separate identity). Customer login
 * already blocks a suspended/banned account from getting a new token;
 * suspend() and ban() here additionally revoke every token the customer
 * already holds, so an existing session dies immediately rather than
 * staying valid until it naturally expires.
 */
class CustomerService
{
    public function suspend(SystemAdmin $admin, Customer $customer, string $reason): Customer
    {
        if ($customer->status === Customer::STATUS_SUSPENDED) {
            throw ValidationException::withMessages(['status' => ['This account is already suspended.']]);
        }

        $customer->update([
            'status' => Customer::STATUS_SUSPENDED,
            'suspended_reason' => $reason,
            'suspended_at' => now(),
        ]);

        $customer->tokens()->delete();

        AuditService::edit('Customer', $customer->id, $customer->name, null, ['status' => 'suspended', 'reason' => $reason, 'decided_by_admin_id' => $admin->id]);

        return $customer->fresh();
    }

    public function ban(SystemAdmin $admin, Customer $customer, string $reason): Customer
    {
        $customer->update([
            'status' => Customer::STATUS_BANNED,
            'suspended_reason' => $reason,
            'suspended_at' => now(),
        ]);

        $customer->tokens()->delete();

        AuditService::edit('Customer', $customer->id, $customer->name, null, ['status' => 'banned', 'reason' => $reason, 'decided_by_admin_id' => $admin->id]);

        return $customer->fresh();
    }

    public function activate(SystemAdmin $admin, Customer $customer): Customer
    {
        $customer->update([
            'status' => Customer::STATUS_ACTIVE,
            'suspended_reason' => null,
            'suspended_at' => null,
        ]);

        AuditService::edit('Customer', $customer->id, $customer->name, null, ['status' => 'active', 'decided_by_admin_id' => $admin->id]);

        return $customer->fresh();
    }
}
