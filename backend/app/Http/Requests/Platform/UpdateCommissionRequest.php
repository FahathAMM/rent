<?php

namespace App\Http\Requests\Platform;

class UpdateCommissionRequest extends StoreCommissionRequest
{
    // Identical validation shape to creating one — no unique constraints
    // are involved, so nothing needs to change for an update.
}
