<?php
/*
 * POST api/logout.php → ends the session and replies {"ok": true}
 * GET  api/logout.php → ends the session and returns to the sign-in page (handy as a plain link)
 */
declare(strict_types=1);

require __DIR__ . '/core/bootstrap.php';

require_method('GET', 'POST');

logout();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    header('Location: ../login.html', true, 303);
    exit;
}

json_out(['ok' => true]);
