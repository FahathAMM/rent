<?php

namespace App\Services;

use App\Models\Administration\AuditLog;
use App\Models\Administration\User;
use App\Models\ImpersonationSession;
use App\Models\SystemAdmin;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * "Login as user" - lets a Platform Admin work inside any marketplace
 * account (customer, owner or shop staff) without ever seeing or entering
 * that user's password.
 *
 * A real Sanctum token is minted for the target user (scoped to a short
 * lifetime and tied 1:1 to an ImpersonationSession row), so the account
 * app needs no special-casing: it just sees a normal authenticated
 * request. Ending the session revokes exactly that token.
 */
class ImpersonationService
{
    public function start(SystemAdmin $admin, User $targetUser, Request $request): array
    {
        if (!$targetUser->isActive()) {
            throw ValidationException::withMessages([
                'user_id' => ['This user account is deactivated.'],
            ]);
        }

        return DB::transaction(function () use ($admin, $targetUser, $request) {
            $newToken = $targetUser->createToken(
                'impersonation-by-' . $admin->id,
                ['*'],
                now()->addHours(4)
            );

            $session = ImpersonationSession::create([
                'system_admin_id'          => $admin->id,
                'user_id'                  => $targetUser->id,
                'personal_access_token_id' => $newToken->accessToken->id,
                'started_at'               => now(),
                'ip_address'               => $request->ip(),
                'user_agent'               => $request->userAgent(),
            ]);

            AuditLog::create([
                'user_id'         => $targetUser->id,
                'system_admin_id' => $admin->id,
                'action'          => 'impersonate_start',
                'form'            => 'Impersonation',
                'record_id'       => $session->id,
                'record'          => $targetUser->name,
                'severity'        => 'critical',
                'after'           => ['impersonation_session_id' => $session->id],
                'ip'              => $request->ip(),
                'browser'         => $request->userAgent(),
            ]);

            return [
                'token'   => $newToken->plainTextToken,
                'user'    => $targetUser,
                'session' => $session,
            ];
        });
    }

    public function stop(SystemAdmin $admin, int $sessionId, Request $request): ImpersonationSession
    {
        $session = ImpersonationSession::with('user')->findOrFail($sessionId);

        if (!$session->isActive()) {
            return $session;
        }

        DB::transaction(function () use ($session, $admin, $request) {
            if ($session->personal_access_token_id) {
                DB::table('personal_access_tokens')->where('id', $session->personal_access_token_id)->delete();
            }

            $session->update(['ended_at' => now()]);

            AuditLog::create([
                'user_id'         => $session->user_id,
                'system_admin_id' => $admin->id,
                'action'          => 'impersonate_stop',
                'form'            => 'Impersonation',
                'record_id'       => $session->id,
                'record'          => $session->user?->name,
                'severity'        => 'critical',
                'after'           => ['impersonation_session_id' => $session->id],
                'ip'              => $request->ip(),
                'browser'         => $request->userAgent(),
            ]);
        });

        return $session->fresh();
    }
}
