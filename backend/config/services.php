<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'token' => env('POSTMARK_TOKEN'),
    ],

    'resend' => [
        'key' => env('RESEND_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | PayHere (Sri Lanka)
    |--------------------------------------------------------------------------
    |
    | Must be confirmed against the live merchant account before going to
    | production - see app-doc/marketplace/06-plan-and-risks.md "PayHere
    | capability assumptions". sandbox=true uses PayHere's sandbox checkout
    | host; the hash algorithms themselves (checkout + notify verification)
    | are identical between sandbox and live.
    */
    'payhere' => [
        'merchant_id' => env('PAYHERE_MERCHANT_ID'),
        'merchant_secret' => env('PAYHERE_MERCHANT_SECRET'),
        'sandbox' => env('PAYHERE_SANDBOX', true),
        // The actual fee schedule is unconfirmed against a live merchant
        // account (see the "sandbox" comment above) — this default
        // matches the figure MarketplaceDemoSeeder already uses for its
        // seeded financials, so demo and real-confirmed bookings are
        // computed the same way until the real figure is confirmed.
        'fee_percentage' => env('PAYHERE_FEE_PERCENTAGE', 3.3),
    ],

];
