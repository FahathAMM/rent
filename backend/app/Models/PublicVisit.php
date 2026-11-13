<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * One page visit — a public page opened by a guest/customer, or a vendor
 * app page opened by a signed-in owner/staff member (see `type`). Written
 * by VisitLogController, shown on /platform/visits.
 */
class PublicVisit extends Model
{
    public const UPDATED_AT = null;

    public const TYPE_PUBLIC = 'public_visit';
    public const TYPE_VENDOR = 'vendor_visit';

    /** The visit types kept in this table (the rest only go to the daily log file). */
    public const STORED_TYPES = [self::TYPE_PUBLIC, self::TYPE_VENDOR];

    protected $fillable = [
        'type', 'path', 'customer_id', 'customer_name', 'user_id', 'user_name', 'shop_id', 'shop_name',
        'ip', 'country', 'city', 'isp', 'timezone', 'user_agent',
    ];
}
