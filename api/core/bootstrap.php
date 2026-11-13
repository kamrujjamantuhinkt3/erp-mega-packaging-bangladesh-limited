<?php
/* Shared by every API endpoint: JSON replies, sessions, CSRF protection and sign-in */
declare(strict_types=1);

require_once __DIR__ . '/config.php';

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

function start_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
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

/* ---------- Sign-in ---------- */

/** The signed-in user, or null */
function current_user(): ?array
{
    $username = $_SESSION['user']['username'] ?? null;
    return is_string($username) ? ['username' => $username] : null;
}

/** Checks the placeholder credentials and signs the user in */
function attempt_login(string $username, string $password): bool
{
    // Both checks always run, so the response time doesn't hint at which one failed
    $userOk = hash_equals(strtolower(PLACEHOLDER_USERNAME), strtolower($username));
    $passOk = hash_equals(PLACEHOLDER_PASSWORD, $password);
    if (!$userOk || !$passOk) {
        return false;
    }

    session_regenerate_id(true);
    $_SESSION['user'] = [
        'username'  => PLACEHOLDER_USERNAME,
        'signed_in' => time(),
    ];
    unset($_SESSION['csrf']); // a fresh token for the signed-in session
    return true;
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

/* Every endpoint gets a session and safe default headers */
start_session();
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
