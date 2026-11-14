<?php
/*
 * GET api/session.php
 * Tells the frontend whether someone is signed in, or is part-way through (password done,
 * one-time code pending: "otp" is then filled in, so a reloaded page can resume), and hands
 * out the CSRF token it must send back (X-CSRF-Token header) with every POST.
 */
declare(strict_types=1);

require __DIR__ . '/core/bootstrap.php';

require_method('GET');

$user = current_user();

json_out([
    'ok'            => true,
    'authenticated' => $user !== null,
    'user'          => $user,
    'otp'           => $user === null ? otp_status() : null,
    'csrf'          => csrf_token(),
]);
