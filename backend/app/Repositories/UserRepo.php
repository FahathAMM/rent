<?php

namespace App\Repositories;

use App\Http\Requests\User\StoreUserRequest;
use App\Http\Requests\User\UpdateUserRequest;
use App\Models\Administration\User;
use App\Services\AuthUser;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Spatie\Permission\Models\Role;

class UserRepo extends BaseRepository
{
    protected $model;

    public function __construct(User $model)
    {
        $this->model = $model;
    }

    public function getData(Request $request): LengthAwarePaginator
    {
        $sortable = ['name', 'email', 'employee_id', 'is_active', 'joining_date', 'created_at'];
        $sort = in_array($request->sort_field, $sortable) ? $request->sort_field : 'created_at';
        $dir  = $request->sort_direction === 'asc' ? 'asc' : 'desc';

        return $this->model->with('roles', 'permissions')
            ->when($request->search, fn ($q) =>
                $q->where('name', 'like', "%{$request->search}%")
                  ->orWhere('email', 'like', "%{$request->search}%")
                  ->orWhere('employee_id', 'like', "%{$request->search}%")
                  ->orWhere('phone', 'like', "%{$request->search}%"))
            ->orderBy($sort, $dir)
            ->paginate(min($request->perPage ?? 20, 100));
    }

    public function store(StoreUserRequest $request): User
    {
        $data = $request->validated();

        $roles = $data['roles'] ?? [];
        unset($data['roles'], $data['avatar']);

        $user = $this->model->create($data);

        if ($request->hasFile('avatar')) {
            $user->imageUpload('avatars', $user, $request->file('avatar'), 'avatar');
        }

        $user->syncRoles(Role::whereIn('name', $roles)->where('guard_name', 'web')->get());

        return $user->fresh(['roles', 'permissions']);
    }

    public function update(User $user, UpdateUserRequest $request): User
    {
        $data = $request->validated();

        if (array_key_exists('roles', $data)) {
            $names = $data['roles'] ?? [];
            $user->syncRoles(Role::whereIn('name', $names)->where('guard_name', 'web')->get());
            unset($data['roles']);
        }

        unset($data['avatar']);

        $user->update($data);

        if ($request->hasFile('avatar')) {
            if ($user->avatar) {
                Storage::disk('public')->delete($user->avatar);
            }
            $user->imageUpload('avatars', $user, $request->file('avatar'), 'avatar');
        }

        return $user->fresh(['roles', 'permissions']);
    }

    public function destroy(User $user): void
    {
        if (AuthUser::is($user)) {
            throw new \RuntimeException('Cannot delete your own account.');
        }

        if ($user->avatar) {
            Storage::disk('public')->delete($user->avatar);
        }

        $user->delete();
    }
}
