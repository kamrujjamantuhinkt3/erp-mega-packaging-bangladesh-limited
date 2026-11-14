<?php
/* ---------------------------------------------------------------------------
   db.php: the one MySQL connection, and the tables it expects.

   The database details come from db.config.php (not in git). The tables are
   made on the first request that needs them, so there is nothing to import
   in phpMyAdmin. The administrator is made on the setup page (setup.html).
   Every query goes through a prepared statement.
--------------------------------------------------------------------------- */
declare(strict_types=1);

/** The database details from db.config.php; stops with a clear message while they're missing */
function db_config(): array
{
    static $config = null;
    if ($config !== null) {
        return $config;
    }

    $file = __DIR__ . '/db.config.php';
    if (!is_file($file)) {
        db_unavailable('Not configured yet: api/core/db.config.php is missing (copy db.config.sample.php).');
    }
    $d = require $file;
    if (!is_array($d)) {
        db_unavailable('api/core/db.config.php is not returning its settings.');
    }
    if (str_contains((string) ($d['pass'] ?? ''), 'PUT-THE-')) {
        db_unavailable('Not configured yet: put the database name, user and password into api/core/db.config.php.');
    }
    return $config = $d;
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo !== null) {
        return $pdo;
    }

    $d = db_config();
    if (!extension_loaded('pdo_mysql')) {
        db_unavailable('PHP\'s MySQL driver (pdo_mysql) is not enabled on this server.');
    }

    try {
        $conn = new PDO(
            'mysql:host=' . $d['host'] . ';dbname=' . $d['name'] . ';charset=utf8mb4',
            (string) $d['user'],
            (string) $d['pass'],
            [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
                PDO::ATTR_TIMEOUT            => 5,
            ]
        );
        $conn->exec("SET time_zone = '+06:00'");   // Asia/Dhaka, the same clock as PHP
    } catch (PDOException $e) {
        db_unavailable('The database is not reachable. Check the details in api/core/db.config.php.', $e);
    }

    try {
        create_tables($conn);
    } catch (PDOException $e) {
        db_unavailable('The database tables could not be prepared.', $e);
    }

    return $pdo = $conn;
}

/** The tables, made only if missing: safe to run on every connection */
function create_tables(PDO $pdo): void
{
    /* People who can sign in. Sign-in is two steps: password, then a one-time
       code sent by SMS to `mobile` (international format, +8801XXXXXXXXX).
       `role` is 'admin' for the administrator made on the setup page.
       `password_changed_at`: sessions signed in before it are signed out. */
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS users (
            id                  INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            username            VARCHAR(50)  NOT NULL,
            email               VARCHAR(190) NOT NULL,
            name                VARCHAR(120) NOT NULL,
            mobile              VARCHAR(20)  NOT NULL,
            role                VARCHAR(20)  NOT NULL DEFAULT 'user',
            password_hash       VARCHAR(255) NOT NULL,
            is_active           TINYINT(1)   NOT NULL DEFAULT 1,
            last_login_at       DATETIME     NULL,
            password_changed_at DATETIME     NULL,
            created_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY u_username (username),
            UNIQUE KEY u_email (email)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );

    /* Setup-key checks on the setup page, so wrong guesses can be limited per address */
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS setup_attempts (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            ip VARCHAR(45)  NOT NULL,
            at DATETIME     NOT NULL,
            ok TINYINT(1)   NOT NULL DEFAULT 0,
            KEY k_ip_at (ip, at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
}

/** Stops with a JSON 503. The detail goes to the error log, and to the page only in development. */
function db_unavailable(string $message, ?Throwable $e = null): never
{
    if ($e !== null) {
        error_log('Mega ERP database: ' . $e->getMessage());
        if (APP_ENV === 'development') {
            $message .= ' (' . $e->getMessage() . ')';
        }
    }
    json_out(['ok' => false, 'error' => $message], 503);
}
