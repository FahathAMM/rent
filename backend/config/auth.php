<?php

return [

    'defaults' => [
        'guard'     => 'web',
        'passwords' => 'users',
    ],

    'guards' => [
        'web' => [
            'driver'   => 'session',
            'provider' => 'users',
        ],
        'sanctum' => [
            'driver'   => 'sanctum',
            'provider' => 'users',
        ],

        // Platform Owner / Platform Admin — completely separate from the
        // company (`sanctum`) guard above. Sanctum validates that a bearer
        // token's tokenable model matches this guard's provider model, so a
        // company user's token is rejected here and vice versa.
        'platform' => [
            'driver'   => 'sanctum',
            'provider' => 'system_admins',
        ],
    ],

    'providers' => [
        'users' => [
            'driver' => 'eloquent',
            'model'  => App\Models\Administration\User::class,
        ],

        'system_admins' => [
            'driver' => 'eloquent',
            'model'  => App\Models\SystemAdmin::class,
        ],
    ],

    'passwords' => [
        'users' => [
            'provider' => 'users',
            'table'    => 'password_reset_tokens',
            'expire'   => 60,
            'throttle' => 60,
        ],
    ],

    'password_timeout' => 10800,
];
