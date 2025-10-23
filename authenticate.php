<?php
session_start();

// Define your correct PIN here
$correct_pin = '1640'; // Replace with the actual PIN

// Check if the PIN was submitted
if (isset($_POST['pin'])) {
    $entered_pin = $_POST['pin'];

    // If the PIN is correct, set session variables
    if ($entered_pin === $correct_pin) {
        $_SESSION['authenticated'] = true;
        $_SESSION['login_time'] = time(); // Track the login time
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['success' => false]);
    }
} else {
    echo json_encode(['success' => false]);
}
?>