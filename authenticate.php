<?php
require_once __DIR__ . '/auth.php';
header('Content-Type: application/json');

function respond($success, $message = null)
{
    echo json_encode(['success' => $success, 'message' => $message]);
    exit;
}

$pinHash = auth_pin_hash();
if ($pinHash === null) {
    http_response_code(500);
    respond(false, 'Server not configured: copy config.example.php to config.php and set a PIN hash.');
}

if (!isset($_POST['pin'])) {
    respond(false);
}

$locked = auth_locked_seconds();
if ($locked > 0) {
    http_response_code(429);
    respond(false, 'Too many attempts. Try again in ' . ceil($locked / 60) . ' minute(s).');
}

if (password_verify((string) $_POST['pin'], $pinHash)) {
    auth_clear_failures();
    auth_session_start();
    session_regenerate_id(true);
    $_SESSION['authenticated'] = true;
    $_SESSION['login_time'] = time();
    respond(true);
}

auth_record_failure();
usleep(500000); // slow down guessing
respond(false, 'Invalid PIN. Please try again.');
