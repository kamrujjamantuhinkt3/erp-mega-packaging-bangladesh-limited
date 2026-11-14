<?php
/*
 * POST api/login.php   body: {"identifier": "email or username", "password": "..."}
 * Step one of sign-in. A right password doesn't sign in yet: it texts a one-time code to
 * the account's mobile and replies with the code's status (step two is api/verify-otp.php).
 * Replies 200, or 401 / 403 / 422 with an error message.
 */
declare(strict_types=1);

require __DIR__ . '/core/bootstrap.php';

require_method('POST');
require_csrf();

$body       = request_json();
$identifier = trim(json_string($body, 'identifier'));
$password   = json_string($body, 'password');

if ($identifier === '' || $password === '') {
    json_out(['ok' => false, 'error' => 'Please enter your email or username and your password.'], 422);
}

$user = find_user($identifier);
if (!password_matches($user, $password)) {
    json_out(['ok' => false, 'error' => 'Incorrect email, username or password.'], 401);
}

json_out(['ok' => true, 'step' => 'otp', 'otp' => begin_otp($user), 'csrf' => csrf_token()]);
