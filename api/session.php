<?php
/*
 * GET api/session.php
 * Tells the frontend whether someone is signed in, and hands out the CSRF token
 * it must send back (X-CSRF-Token header) with every POST.
 */
declare(strict_types=1);

require __DIR__ . '/core/bootstrap.php';

require_method('GET');

json_out([
    'ok'            => true,
    'authenticated' => current_user() !== null,
    'user'          => current_user(),
    'csrf'          => csrf_token(),
]);
