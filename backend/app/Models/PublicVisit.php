<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** A public page visit — written by VisitLogController, shown on /platform/visits. */
class PublicVisit extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = ['path', 'customer_id', 'customer_name', 'ip', 'country', 'city', 'isp', 'timezone', 'user_agent'];
}
