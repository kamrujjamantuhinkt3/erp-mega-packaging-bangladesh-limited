<?php
/*
 * POST api/login.php   body: {"username": "...", "password": "..."}
 * Signs in with the placeholder credentials. Replies 200, or 401 / 403 / 422 with an error message.
 */
declare(strict_types=1);

require __DIR__ . '/core/bootstrap.php';

require_method('POST');

if (!csrf_valid()) {
    // The reply carries a fresh token so the page can simply try again
    json_out(['ok' => false, 'error' => 'Your session has expired. Please try again.', 'csrf' => csrf_token()], 403);
}

$body     = request_json();
$username = trim(json_string($body, 'username'));
$password = json_string($body, 'password');

if ($username === '' || $password === '') {
    json_out(['ok' => false, 'error' => 'Please enter your username and password.'], 422);
}

if (!attempt_login($username, $password)) {
    json_out(['ok' => false, 'error' => 'Incorrect username or password.'], 401);
}

json_out(['ok' => true, 'user' => current_user(), 'csrf' => csrf_token()]);
