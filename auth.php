<?php
// Shared authentication helpers. Include with require_once and call require_auth()
// at the top of any endpoint that writes to the server.

const AUTH_SESSION_TTL = 8 * 3600;   // seconds a login stays valid
const AUTH_MAX_FAILURES = 5;         // wrong PINs allowed per IP...
const AUTH_LOCKOUT_SECONDS = 900;    // ...before that IP is locked out

function auth_session_start()
{
    if (session_status() === PHP_SESSION_NONE) {
        session_set_cookie_params([
            'lifetime' => 0,
            'httponly' => true,
            'samesite' => 'Lax',
            'secure' => !empty($_SERVER['HTTPS']),
        ]);
        session_start();
    }
}

// Returns the PIN hash from config.php, or null if the server isn't configured.
function auth_pin_hash()
{
    $file = __DIR__ . '/config.php';
    if (!is_file($file)) {
        return null;
    }
    $config = require $file;
    return is_array($config) && !empty($config['pin_hash']) ? $config['pin_hash'] : null;
}

function is_authenticated()
{
    auth_session_start();
    return !empty($_SESSION['authenticated'])
        && (time() - ($_SESSION['login_time'] ?? 0)) < AUTH_SESSION_TTL;
}

function require_auth()
{
    if (!is_authenticated()) {
        http_response_code(401);
        echo 'Error: Not authorized. Reload the page and enter the PIN again.';
        exit;
    }
}

// Failed-attempt tracking is per client IP and stored on disk, so it can't be
// reset by discarding the session cookie.
function auth_attempts_file()
{
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    return sys_get_temp_dir() . '/jeopardy_auth_' . md5($ip) . '.json';
}

function auth_read_attempts()
{
    $data = @json_decode((string) @file_get_contents(auth_attempts_file()), true);
    return is_array($data) ? $data : ['failures' => 0, 'locked_until' => 0];
}

function auth_locked_seconds()
{
    $data = auth_read_attempts();
    return max(0, ($data['locked_until'] ?? 0) - time());
}

function auth_record_failure()
{
    $data = auth_read_attempts();
    $data['failures'] = ($data['failures'] ?? 0) + 1;
    if ($data['failures'] >= AUTH_MAX_FAILURES) {
        $data = ['failures' => 0, 'locked_until' => time() + AUTH_LOCKOUT_SECONDS];
    }
    @file_put_contents(auth_attempts_file(), json_encode($data), LOCK_EX);
}

function auth_clear_failures()
{
    @unlink(auth_attempts_file());
}
