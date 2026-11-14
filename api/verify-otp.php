<?php
/*
 * POST api/verify-otp.php   body: {"code": "123456"}
 * Step two of sign-in: checks the one-time code; when it matches, the user is signed in.
 * Errors: 401 wrong code (tries left in the message), 410 expired, 409/429 with
 * "restart": true when the sign-in has to begin again from the password.
 */
declare(strict_types=1);

require __DIR__ . '/core/bootstrap.php';

require_method('POST');
require_csrf();

$code   = preg_replace('/\s+/', '', json_string(request_json(), 'code')) ?? '';
$result = verify_otp($code);

if (!$result['ok']) {
    json_out([
        'ok'      => false,
        'error'   => $result['error'],
        'restart' => $result['restart'],
        'otp'     => otp_status(),
    ], $result['status']);
}

json_out(['ok' => true, 'user' => current_user(), 'csrf' => csrf_token()]);
