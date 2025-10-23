<?php
if ($_SERVER['REQUEST_METHOD'] == 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);

    if (isset($data['folder']) && isset($data['categories'])) {
        $folder = $data['folder'];
        $categories = $data['categories'];

        // Ensure the directory exists
        if (!is_dir($folder)) {
            if (!mkdir($folder, 0777, true)) {
                error_log('Failed to create directory: ' . $folder);
                echo 'Failed to create directory.';
                exit;
            }
        }

        // Try to update game.json if it exists
        $gameJsonPath = $folder . '/game.json';
        if (file_exists($gameJsonPath)) {
            $gameConfig = json_decode(file_get_contents($gameJsonPath), true);
            if ($gameConfig !== null) {
                // Update categories in game config
                $gameConfig['categories'] = $categories;

                // Save updated config
                if (file_put_contents($gameJsonPath, json_encode($gameConfig, JSON_PRETTY_PRINT)) !== false) {
                    // Also update categories.txt for backward compatibility
                    $categoriesPath = $folder . '/categories.txt';
                    file_put_contents($categoriesPath, implode("\n", $categories));

                    echo 'Categories saved successfully.';
                    exit;
                } else {
                    error_log('Failed to write to game.json: ' . $gameJsonPath);
                    echo 'Failed to save categories to game.json.';
                    exit;
                }
            }
        }

        // Fallback: save to categories.txt if game.json doesn't exist
        $filePath = $folder . '/categories.txt';
        $fileContent = implode("\n", $categories);

        // Write the categories to the file
        if (file_put_contents($filePath, $fileContent) !== false) {
            echo 'Categories saved successfully.';
        } else {
            error_log('Failed to write to file: ' . $filePath);
            echo 'Failed to save categories.';
        }
    } else {
        error_log('Invalid input: ' . print_r($data, true));
        echo 'Invalid input.';
    }
} else {
    error_log('Invalid request method.');
    echo 'Invalid request method.';
}
?>
