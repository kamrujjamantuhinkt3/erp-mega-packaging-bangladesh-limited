<?php
/*
 * POST api/resend-otp.php
 * Texts a new one-time code (the old one stops working). Allowed once the wait after the
 * last code is over, up to the limit per sign-in. Errors: 429 too soon (or the limit,
 * with "restart": true), 409 with "restart": true when there is no sign-in in progress.
 */
declare(strict_types=1);

require __DIR__ . '/core/bootstrap.php';

require_method('POST');
require_csrf();

$result = resend_otp();

if (!$result['ok']) {
    json_out([
        'ok'      => false,
        'error'   => $result['error'],
        'restart' => $result['restart'],
        'otp'     => otp_status(),
    ], $result['status']);
}

json_out(['ok' => true, 'otp' => $result['otp']]);
