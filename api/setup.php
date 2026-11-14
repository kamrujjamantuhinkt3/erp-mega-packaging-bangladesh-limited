<?php
/*
 * The administrator setup, used by setup.html.
 *
 * GET  api/setup.php   Connects to the database (making the tables if they're missing) and says
 *                      whether an administrator exists yet. A 503 explains what's wrong instead.
 * POST api/setup.php   body: {"key", "name", "username", "email", "mobile", "password", "password2"}
 *                      Creates the administrator the first time; after that, replaces its details
 *                      and password, which signs that account out everywhere.
 *
 * The setup key is the database password written in api/core/db.config.php. Only whoever controls
 * the hosting account can read that file, so only they can create or change the administrator.
 * Wrong keys are limited per address (SETUP_MAX_ATTEMPTS in config.php).
 * Delete setup.html and this file from the server once the administrator is set; upload them
 * again whenever the administrator needs resetting.
 */
declare(strict_types=1);

require __DIR__ . '/core/bootstrap.php';

require_method('GET', 'POST');
header('X-Robots-Tag: noindex, nofollow');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET') {
    json_out(['ok' => true, 'has_admin' => find_admin() !== null, 'csrf' => csrf_token()]);
}

require_csrf();

$ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');   // only REMOTE_ADDR: a forwarded-for header is whatever the caller wrote
if (setup_locked_out($ip)) {
    json_out(['ok' => false, 'error' => sprintf('Too many wrong setup keys. Wait %d minutes and try again.', SETUP_LOCKOUT_MINUTES)], 429);
}

$body = request_json();
if (!hash_equals((string) db_config()['pass'], json_string($body, 'key'))) {
    note_setup_attempt($ip, false);
    fail_field('key', 'That setup key isn\'t right. It is the database password written in api/core/db.config.php.', 401);
}

$name     = trim((string) preg_replace('/\s+/u', ' ', json_string($body, 'name')));
$username = strtolower(trim(json_string($body, 'username')));
$email    = strtolower(trim(json_string($body, 'email')));
$mobile   = normalize_mobile(json_string($body, 'mobile'));
$password = json_string($body, 'password');
$again    = json_string($body, 'password2');

$admin = find_admin();
$keep  = $admin === null ? 0 : (int) $admin['id'];   // its own username and email aren't "taken"

if ($name === '' || preg_match_all('/./su', $name) > 120) {   // characters, not bytes: names may be in Bangla
    fail_field('name', 'Enter the administrator\'s full name.');
}
if (preg_match('/^[a-z0-9][a-z0-9._-]{2,49}$/', $username) !== 1) {
    fail_field('username', 'Choose a username of 3 to 50 characters: letters, numbers, dots, dashes or underscores.');
}
if (taken('username', $username, $keep)) {
    fail_field('username', 'That username belongs to another account. Choose another.');
}
if (strlen($email) > 190 || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
    fail_field('email', 'Enter a valid email address.');
}
if (taken('email', $email, $keep)) {
    fail_field('email', 'That email address belongs to another account.');
}
if ($mobile === null) {
    fail_field('mobile', 'Enter a Bangladeshi mobile number, for example 01712-345678. The sign-in code is sent there.');
}
if (strlen($password) < 10 || strlen($password) > 72) {
    fail_field('password', 'Choose a password of 10 to 72 characters.');
}
if (strcasecmp($password, $username) === 0 || strcasecmp($password, $email) === 0) {
    fail_field('password', 'The password can\'t be the same as the username or email.');
}
if (!hash_equals($password, $again)) {
    fail_field('password2', 'The two passwords don\'t match.');
}

$hash = password_hash($password, PASSWORD_DEFAULT);
if ($admin === null) {
    db()->prepare(
        "INSERT INTO users (username, email, name, mobile, role, password_hash) VALUES (?, ?, ?, ?, 'admin', ?)"
    )->execute([$username, $email, $name, $mobile, $hash]);
} else {
    // a new password: every session this account already has is signed out (see current_user)
    db()->prepare(
        'UPDATE users SET username = ?, email = ?, name = ?, mobile = ?, password_hash = ?,
                is_active = 1, password_changed_at = ? WHERE id = ?'
    )->execute([$username, $email, $name, $mobile, $hash, date('Y-m-d H:i:s'), $admin['id']]);
}
note_setup_attempt($ip, true);

json_out([
    'ok'      => true,
    'created' => $admin === null,
    'admin'   => ['name' => $name, 'username' => $username, 'email' => $email, 'mobile' => mask_mobile($mobile)],
]);

/* ---------- Helpers for this page ---------- */

/** The administrator account (the first one made), or null */
function find_admin(): ?array
{
    $row = db()->query("SELECT id, username, name FROM users WHERE role = 'admin' ORDER BY id LIMIT 1")->fetch();
    return $row === false ? null : $row;
}

/** Whether another account already uses this username or email */
function taken(string $column, string $value, int $exceptId): bool
{
    $column = $column === 'email' ? 'email' : 'username';   // never anything else in the SQL
    $stmt = db()->prepare("SELECT 1 FROM users WHERE $column = ? AND id <> ? LIMIT 1");
    $stmt->execute([$value, $exceptId]);
    return $stmt->fetchColumn() !== false;
}

/** 01712-345678, +880 1712 345678, 8801712345678 … → +8801712345678; null if not a Bangladeshi mobile */
function normalize_mobile(string $input): ?string
{
    $digits = preg_replace('/[\s\-().]/', '', $input) ?? '';
    return preg_match('/^(?:\+?88)?(01[3-9]\d{8})$/', $digits, $m) === 1 ? '+88' . $m[1] : null;
}

function setup_locked_out(string $ip): bool
{
    $stmt = db()->prepare('SELECT COUNT(*) FROM setup_attempts WHERE ip = ? AND ok = 0 AND at > ?');
    $stmt->execute([$ip, date('Y-m-d H:i:s', time() - SETUP_LOCKOUT_MINUTES * 60)]);
    return (int) $stmt->fetchColumn() >= SETUP_MAX_ATTEMPTS;
}

function note_setup_attempt(string $ip, bool $ok): void
{
    db()->prepare('INSERT INTO setup_attempts (ip, at, ok) VALUES (?, ?, ?)')
        ->execute([$ip, date('Y-m-d H:i:s'), $ok ? 1 : 0]);
    // the table only needs the recent past
    db()->prepare('DELETE FROM setup_attempts WHERE at < ?')->execute([date('Y-m-d H:i:s', time() - 7 * 86400)]);
}

/** Stops with an error tied to one field of the form, so the page can point at it */
function fail_field(string $field, string $error, int $status = 422): never
{
    json_out(['ok' => false, 'error' => $error, 'field' => $field], $status);
}
