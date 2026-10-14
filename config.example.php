<?php
// Copy this file to config.php (which is git-ignored) and set your own PIN hash.
//
// Generate a hash for a new PIN with:
//   php -r 'echo password_hash("YOUR-PIN", PASSWORD_DEFAULT), "\n";'
return [
    'pin_hash' => 'PASTE_HASH_HERE',
];
