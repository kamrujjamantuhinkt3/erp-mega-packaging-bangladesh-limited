<?php
/* Shared by every API endpoint: JSON replies, sessions, CSRF protection,
   and the two-step sign-in (password, then a one-time code by SMS) */
declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';

/* ---------- Requests & replies ---------- */

function json_out(array $data, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

/** Stops with 405 unless the request uses one of the given methods */
function require_method(string ...$methods): void
{
    if (!in_array($_SERVER['REQUEST_METHOD'] ?? 'GET', $methods, true)) {
        header('Allow: ' . implode(', ', $methods));
        json_out(['ok' => false, 'error' => 'Method not allowed.'], 405);
    }
}

/** Stops with 403 (and a fresh token, so the page can retry) unless the CSRF token is valid */
function require_csrf(): void
{
    if (!csrf_valid()) {
        json_out(['ok' => false, 'error' => 'Your session has expired. Please try again.', 'csrf' => csrf_token()], 403);
    }
}

/** The request's JSON body as an array (empty when missing or invalid) */
function request_json(): array
{
    $data = json_decode((string) file_get_contents('php://input'), true);
    return is_array($data) ? $data : [];
}

/** A text field from a decoded JSON body ('' when missing or not text) */
function json_string(array $data, string $key): string
{
    $value = $data[$key] ?? '';
    return is_string($value) ? $value : '';
}

/* ---------- Sessions ---------- */

function is_https(): bool
{
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (int) ($_SERVER['SERVER_PORT'] ?? 0) === 443
        || strtolower((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https';
}

/**
 * Sessions are kept in api/private/sessions, inside the ERP's own folder and away
 * from every other site on the hosting account (that folder is never served).
 */
function start_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    $dir = dirname(__DIR__) . '/private/sessions';
    if (!is_dir($dir)) {
        @mkdir($dir, 0700, true);
    }
    if (is_dir($dir) && is_writable($dir)) {
        session_save_path($dir);
        // this folder is ours to tidy: clear out old sessions now and then
        ini_set('session.gc_probability', '1');
        ini_set('session.gc_divisor', '100');
    }
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    session_name(SESSION_NAME);
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'secure'   => is_https(),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

function logout(): void
{
    $_SESSION = [];
    $cookie = session_get_cookie_params();
    setcookie(session_name(), '', [
        'expires'  => time() - 3600,
        'path'     => $cookie['path'],
        'domain'   => $cookie['domain'],
        'secure'   => $cookie['secure'],
        'httponly' => $cookie['httponly'],
        'samesite' => $cookie['samesite'],
    ]);
    session_destroy();
}

/* ---------- CSRF ---------- */

function csrf_token(): string
{
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf'];
}

/** Checks the token the frontend sends back in the X-CSRF-Token header */
function csrf_valid(): bool
{
    $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    return is_string($token) && $token !== ''
        && !empty($_SESSION['csrf'])
        && hash_equals($_SESSION['csrf'], $token);
}

/* ---------- Accounts ---------- */

/** The active account an email address or username belongs to (from the users table), or null */
function find_user(string $identifier): ?array
{
    $id = trim($identifier);
    if ($id === '' || strlen($id) > 190) {
        return null;
    }
    $stmt = db()->prepare(
        'SELECT id, username, email, name, mobile, password_hash
           FROM users
          WHERE (username = ? OR email = ?) AND is_active = 1
          LIMIT 1'
    );
    $stmt->execute([$id, $id]);   // the table's collation ignores letter case
    $user = $stmt->fetch();
    return $user === false ? null : $user;
}

/**
 * The password check runs even when no account matched (against a stand-in hash),
 * so the response time doesn't hint at which usernames exist
 */
function password_matches(?array $user, string $password): bool
{
    $hash = $user['password_hash'] ?? '$2y$10$o0RFWnkgpc1Wo0Mlz6KZl.TBsKulZtg.gj4xpydxPHItnyM14QF5G';
    $matches = password_verify($password, $hash);
    if ($user === null || !$matches) {
        return false;
    }
    // PHP's hashing gets stronger over the years: upgrade the stored hash when it does
    if (password_needs_rehash($hash, PASSWORD_DEFAULT)) {
        db()->prepare('UPDATE users SET password_hash = ? WHERE id = ?')
            ->execute([password_hash($password, PASSWORD_DEFAULT), $user['id']]);
    }
    return true;
}

/**
 * The signed-in user (both steps done), or null. Checked against the users table each time,
 * so a deactivated account, or one whose password changed since, is signed out.
 */
function current_user(): ?array
{
    $user = $_SESSION['user'] ?? null;
    if (!is_array($user) || !isset($user['id'])) {
        return null;
    }
    $stmt = db()->prepare('SELECT username, name, is_active, password_changed_at FROM users WHERE id = ?');
    $stmt->execute([$user['id']]);
    $row = $stmt->fetch();
    $changed = $row && $row['password_changed_at'] !== null ? strtotime($row['password_changed_at']) : 0;
    if (!$row || (int) $row['is_active'] !== 1 || $changed > (int) $user['signed_in']) {
        unset($_SESSION['user']);
        return null;
    }
    return ['username' => $row['username'], 'name' => $row['name']];
}

/* ---------- Step two: the one-time code ---------- */

/** The password was right: hold the sign-in open and text the first code */
function begin_otp(array $user): array
{
    session_regenerate_id(true);
    unset($_SESSION['user'], $user['password_hash']);   // the hash never goes into the session
    $_SESSION['otp'] = ['user' => $user, 'sends' => 0, 'attempts' => 0];
    return send_otp();
}

/** Texts a fresh code to the pending account's mobile; returns what the page may know */
function send_otp(): array
{
    $code = str_pad((string) random_int(0, 10 ** OTP_LENGTH - 1), OTP_LENGTH, '0', STR_PAD_LEFT);
    $otp = &$_SESSION['otp'];
    $otp['hash']     = password_hash($code, PASSWORD_DEFAULT);   // the code itself is never stored
    $otp['expires']  = time() + OTP_TTL;
    $otp['sent_at']  = time();
    $otp['attempts'] = 0;
    $otp['sends']++;

    send_sms($otp['user']['mobile'], sprintf(
        'Your Mega Packaging ERP sign-in code is %s. It expires in %d minutes. Never share this code with anyone.',
        $code,
        intdiv(OTP_TTL, 60)
    ));

    if (APP_ENV === 'development') {
        $otp['dev_code'] = $code;   // shown on the sign-in page until an SMS gateway is connected
    }
    return otp_status();
}

/** What the sign-in page may show about the code in progress, or null if none */
function otp_status(): ?array
{
    $otp = $_SESSION['otp'] ?? null;
    if (!is_array($otp) || empty($otp['hash'])) {
        return null;
    }
    $now = time();
    $status = [
        'mobile'        => mask_mobile($otp['user']['mobile']),
        'length'        => OTP_LENGTH,
        'expires_in'    => max(0, $otp['expires'] - $now),
        'resend_in'     => max(0, $otp['sent_at'] + OTP_RESEND_AFTER - $now),
        'resend_after'  => OTP_RESEND_AFTER,
        'resends_left'  => max(0, OTP_MAX_SENDS - $otp['sends']),
        'attempts_left' => max(0, OTP_MAX_ATTEMPTS - $otp['attempts']),
    ];
    if (isset($otp['dev_code'])) {
        $status['dev_code'] = $otp['dev_code'];
    }
    return $status;
}

/** A failed step-two result; $restart means the page must go back to the password */
function otp_failure(string $error, int $status, bool $restart): array
{
    if ($restart) {
        unset($_SESSION['otp']);
    }
    return ['ok' => false, 'error' => $error, 'status' => $status, 'restart' => $restart];
}

/** Checks a code; when it matches, the user is signed in */
function verify_otp(string $code): array
{
    $otp = $_SESSION['otp'] ?? null;
    if (!is_array($otp) || empty($otp['hash'])) {
        return otp_failure('Your sign-in timed out. Please sign in again.', 409, true);
    }
    if (time() > $otp['expires']) {
        return otp_failure('This code has expired. Request a new one below.', 410, false);
    }

    $valid = preg_match('/^\d{' . OTP_LENGTH . '}$/', $code) === 1 && password_verify($code, $otp['hash']);
    if (!$valid) {
        $_SESSION['otp']['attempts']++;
        $left = OTP_MAX_ATTEMPTS - $_SESSION['otp']['attempts'];
        if ($left <= 0) {
            return otp_failure('Too many incorrect codes. Please sign in again.', 429, true);
        }
        return otp_failure(sprintf("That code isn't right. %d %s left.", $left, $left === 1 ? 'try' : 'tries'), 401, false);
    }

    $user = $otp['user'];
    unset($_SESSION['otp']);
    session_regenerate_id(true);
    $_SESSION['user'] = ['id' => $user['id'], 'username' => $user['username'], 'name' => $user['name'], 'signed_in' => time()];
    unset($_SESSION['csrf']);   // a fresh token for the signed-in session
    db()->prepare('UPDATE users SET last_login_at = ? WHERE id = ?')->execute([date('Y-m-d H:i:s'), $user['id']]);
    return ['ok' => true];
}

/** Sends another code, if the wait is over and the limit not reached */
function resend_otp(): array
{
    $otp = $_SESSION['otp'] ?? null;
    if (!is_array($otp) || empty($otp['hash'])) {
        return otp_failure('Your sign-in timed out. Please sign in again.', 409, true);
    }
    $wait = $otp['sent_at'] + OTP_RESEND_AFTER - time();
    if ($wait > 0) {
        return otp_failure(sprintf('Please wait %d seconds before requesting another code.', $wait), 429, false);
    }
    if ($otp['sends'] >= OTP_MAX_SENDS) {
        return otp_failure('Too many codes requested. Please sign in again.', 429, true);
    }
    return ['ok' => true, 'otp' => send_otp()];
}

/** +8801712345678 → "+880 17•• ••• 678": enough to recognise, not enough to read */
function mask_mobile(string $mobile): string
{
    $digits = preg_replace('/\D/', '', $mobile) ?? '';
    if (strlen($digits) === 13 && str_starts_with($digits, '880')) {
        $local = substr($digits, 3);
        return '+880 ' . substr($local, 0, 2) . '•• ••• ' . substr($local, -3);
    }
    return str_repeat('•', max(0, strlen($digits) - 3)) . substr($digits, -3);
}

/*
 * Sends a text message. No SMS gateway is connected yet, so for now the message goes to
 * the server's error log. To go live, call your SMS provider's API here, then set
 * APP_ENV to 'production' in config.php so codes are no longer shown on the page.
 */
function send_sms(string $to, string $message): void
{
    error_log('[SMS to ' . $to . '] ' . $message);
}

/* A database error mid-request still answers in JSON; the detail goes to the error log */
set_exception_handler(static function (Throwable $e): void {
    error_log('Mega ERP: ' . $e);
    $message = $e instanceof PDOException
        ? 'The database could not complete the request. Please try again.'
        : 'Something went wrong on the server. Please try again.';
    if (APP_ENV === 'development') {
        $message .= ' (' . $e->getMessage() . ')';
    }
    json_out(['ok' => false, 'error' => $message], $e instanceof PDOException ? 503 : 500);
});

/**
 * Turns away a request sent from a page on any other address than the ERP's own
 * ('origin' in db.config.php). Browsers always say where a POST comes from.
 */
function require_origin(): void
{
    $origin = (string) ($_SERVER['HTTP_ORIGIN'] ?? '');
    if ($origin === '') {
        return;
    }
    $want = rtrim(strtolower($origin), '/');
    foreach ((array) (db_config()['origin'] ?? []) as $allowed) {
        if (rtrim(strtolower((string) $allowed), '/') === $want) {
            return;
        }
    }
    json_out(['ok' => false, 'error' => 'Refused: this page is not on the address set as "origin" in api/core/db.config.php.'], 403);
}

/* Every endpoint checks where the request came from, and gets a session and safe default headers */
require_origin();
start_session();
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
