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
 * Placeholder account (sign in with the username OR the email).
 * Temporary: accounts move to a MySQL `users` table when user management is built.
 */
const PLACEHOLDER_USERNAME = 'admin';
const PLACEHOLDER_EMAIL    = 'admin@megapackaging.test';
const PLACEHOLDER_PASSWORD = 'admin123';
const PLACEHOLDER_NAME     = 'Administrator';
const PLACEHOLDER_MOBILE   = '+8801700000000';   // where the one-time code is sent

/* Step two of sign-in: a one-time code sent by SMS to the account's mobile */
const OTP_LENGTH       = 6;
const OTP_TTL          = 300;   // seconds a code stays valid
const OTP_MAX_ATTEMPTS = 5;     // wrong entries before the sign-in must start again
const OTP_RESEND_AFTER = 45;    // seconds before another code can be requested
const OTP_MAX_SENDS    = 4;     // codes per sign-in: the first one plus three resends

const SESSION_NAME = 'MEGA_ERP';

date_default_timezone_set('Asia/Dhaka');
