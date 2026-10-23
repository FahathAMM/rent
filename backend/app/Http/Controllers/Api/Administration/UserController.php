<?php

namespace App\Http\Controllers\Api\Administration;

use App\Http\Controllers\Controller;
use App\Http\Requests\User\StoreUserRequest;
use App\Http\Resources\UserResource;
use App\Http\Requests\User\UpdateUserRequest;
use App\Models\Administration\User;
use App\Repositories\UserRepo;
use App\Services\AuditService;
use App\Services\AuthUser;
use App\Services\SubscriptionService;
use App\Traits\JsonResponse as JsonResponseTrait;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class UserController extends Controller
{
    use JsonResponseTrait;

    protected string $modelName = 'User';
    protected string $routeName = 'users';
    protected bool $isDestroyingAllowed;
    protected User $model;
    protected UserRepo $repo;

    public function __construct(User $model, UserRepo $repo)
    {
        $this->model                = $model;
        $this->repo                 = $repo;
        $this->isDestroyingAllowed  = true;

        $this->middleware('can:admin-users-view')->only('index');
        $this->middleware('can:admin-users-view,user')->only('show');
        $this->middleware('can:admin-users-create')->only('store');
        $this->middleware('can:admin-users-edit,user')->only('update');
        $this->middleware('can:admin-users-delete,user')->only('destroy');
    }

    public function index(Request $request): JsonResponse
    {
        $users = $this->repo->getData($request);

        AuditService::view('User', null, '');

        return response()->json([
            'record'  => $users,
            'message' => "{$this->modelName}s retrieved successfully",
            'status'  => true,
        ]);
    }

    public function store(StoreUserRequest $request): JsonResponse
    {
        if ($company = AuthUser::user()->company) {
            app(SubscriptionService::class)->assertWithinLimit($company, 'users');
        }

        try {
            $user = $this->repo->store($request);

            AuditService::create('User', $user->id, $user->name);

            Log::info('User Create', ['user_id' => $user->id, 'created_by' => AuthUser::id()]);

            return $this->response("{$this->modelName} created successfully", new UserResource($user->load('roles', 'permissions')), 201);
        } catch (\Throwable $th) {
            Log::error('UserController@store', ['message' => $th->getMessage(), 'attempted_by' => AuthUser::id()]);

            return $this->response($th->getMessage(), null, 422);
        }
    }

    public function show(User $user): JsonResponse
    {
        AuditService::view('User', $user->id, $user->name);

        return $this->response("{$this->modelName} retrieved successfully", new UserResource($user->load('roles', 'permissions')));
    }

    public function update(UpdateUserRequest $request, User $user): JsonResponse
    {
        try {
            $user = $this->repo->update($user, $request);

            AuditService::edit('User', $user->id, $user->name);

            Log::info('User Update', ['user_id' => $user->id, 'updated_by' => AuthUser::id()]);

            return $this->response("{$this->modelName} updated successfully", new UserResource($user->load('roles', 'permissions')));
        } catch (\Throwable $th) {
            Log::error('UserController@update', ['user_id' => $user->id, 'message' => $th->getMessage(), 'attempted_by' => AuthUser::id()]);

            return $this->response($th->getMessage(), null, 422);
        }
    }

    public function destroy(User $user): JsonResponse
    {
        if ($user->isSuperAdmin()) {
            return $this->response('Super-admin accounts cannot be deleted', null, 403);
        }

        try {
            $recordName = $user->name;

            $this->repo->destroy($user);

            AuditService::delete('User', $user->id, $recordName);

            Log::info('User Delete', ['user_id' => $user->id, 'deleted_by' => AuthUser::id()]);

            return $this->response("{$this->modelName} deleted successfully");
        } catch (\Throwable $th) {
            Log::error('UserController@destroy', ['user_id' => $user->id, 'message' => $th->getMessage(), 'attempted_by' => AuthUser::id()]);

            return $this->response($th->getMessage(), null, 422);
        }
    }
}
