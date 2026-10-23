<?php

namespace App\Repositories;

class BaseRepository
{
    public function getAll()
    {
        return $this->model->all();
    }

    public function findOrFail($id)
    {
        return $this->model->findOrFail($id);
    }

    public function search($q, $page = null)
    {
        $items = $this->model->query();

        if (!is_null($q)) {
            $items->where('name', 'like', '%' . $q . '%');
        }

        if (!is_null($page)) {
            return $items->paginate($page)->withQueryString();
        }

        return $items->get();
    }

    public function create($collection)
    {
        return $this->model->create($collection);
    }
}
