<?php
/* Mega Packaging ERP backend: settings */
declare(strict_types=1);

/*
 * 'development' while no SMS gateway is connected: the one-time code is shown on the
 * sign-in page (and written to the server's error log) so sign-in can be tested.
 * Switch to 'production' once send_sms() in bootstrap.php uses a real SMS gateway.
 */
const APP_ENV = 'development';

/*
 * Accounts live in the MySQL `users` table (see db.php); the database details are in
 * db.config.php. The administrator is made on the setup page (setup.html), which asks
 * for the setup key: the database password written in db.config.php.
 */
const SETUP_MAX_ATTEMPTS    = 8;    // wrong setup keys from one address...
const SETUP_LOCKOUT_MINUTES = 15;   // ...within this many minutes, and that address waits it out

/* Step two of sign-in: a one-time code sent by SMS to the account's mobile */
const OTP_LENGTH       = 6;
const OTP_TTL          = 300;   // seconds a code stays valid
const OTP_MAX_ATTEMPTS = 5;     // wrong entries before the sign-in must start again
const OTP_RESEND_AFTER = 45;    // seconds before another code can be requested
const OTP_MAX_SENDS    = 4;     // codes per sign-in: the first one plus three resends

const SESSION_NAME = 'MEGA_ERP';

date_default_timezone_set('Asia/Dhaka');
