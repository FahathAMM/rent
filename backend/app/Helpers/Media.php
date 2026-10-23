<?php

namespace App\Helpers;

trait Media
{
    public static function imageUpload($location, $model, $file, $columnName)
    {
        $path = $file->store($location, 'public');
        $model->$columnName = $path;
        $model->save();
    }
}
