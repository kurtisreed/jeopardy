<?php
/**
 * Utility script to generate game.json files for existing game folders
 * Run this once to migrate existing games to the new config system
 *
 * Usage: php generate_game_configs.php
 * Or access via browser: http://localhost:8000/generate_game_configs.php
 */

function generateGameConfig($folder_name, $categories, $dd_category = 4, $dd_value = 400)
{
    // Calculate Daily Double image numbers based on category and value
    $pointValues = [100, 200, 300, 400, 500];
    $pointIndex = array_search($dd_value, $pointValues);
    $categoryOffset = ($dd_category - 1) * 10;
    $ddQuestionNum = 1 + $categoryOffset + ($pointIndex * 2);
    $ddAnswerNum = $ddQuestionNum + 1;

    $config = [
        'version' => '1.0',
        'name' => $folder_name,
        'categories' => $categories,
        'pointValues' => $pointValues,
        'dailyDouble' => [
            'enabled' => true,
            'category' => $dd_category,
            'pointValue' => $dd_value,
            'questionImage' => sprintf('%04d.jpg', $ddQuestionNum),
            'answerImage' => sprintf('%04d.jpg', $ddAnswerNum)
        ],
        'finalJeopardy' => [
            'enabled' => true,
            'categoryImage' => '0051.jpg',
            'clueImage' => '0052.jpg',
            'answerImage' => '0053.jpg'
        ],
        'questions' => []
    ];

    // Generate question mappings for all 5 categories
    $imageCounter = 1;
    for ($cat = 1; $cat <= 5; $cat++) {
        $catKey = 'cat' . $cat;
        $config['questions'][$catKey] = [];

        foreach ($config['pointValues'] as $points) {
            $questionImage = sprintf('%04d.jpg', $imageCounter);
            $answerImage = sprintf('%04d.jpg', $imageCounter + 1);

            $config['questions'][$catKey][$points] = [
                'question' => $questionImage,
                'answer' => $answerImage
            ];

            $imageCounter += 2; // Skip to next question (odd numbers)
        }
    }

    return $config;
}

// Get all game folders
$gamesDir = './Games/';
$gameFolders = array_filter(glob($gamesDir . '*'), 'is_dir');

echo "<html><head><title>Generate Game Configs</title><style>
body { font-family: Arial, sans-serif; margin: 20px; }
.success { color: green; }
.error { color: red; }
.warning { color: orange; }
.info { color: blue; }
</style></head><body>";

echo "<h1>Game Config Generator</h1>";
echo "<p>Generating game.json files for existing games...</p><hr>";

$processed = 0;
$skipped = 0;
$errors = 0;

foreach ($gameFolders as $folderPath) {
    $folderName = basename($folderPath);
    $categoriesPath = $folderPath . '/categories.txt';
    $gameJsonPath = $folderPath . '/game.json';

    echo "<p><strong>Processing: $folderName</strong><br>";

    // Check if game.json already exists
    if (file_exists($gameJsonPath)) {
        echo "<span class='warning'>⚠ game.json already exists, skipping...</span></p>";
        $skipped++;
        continue;
    }

    // Check if categories.txt exists
    if (!file_exists($categoriesPath)) {
        echo "<span class='error'>✗ categories.txt not found, skipping...</span></p>";
        $errors++;
        continue;
    }

    // Read categories
    $categoriesContent = file_get_contents($categoriesPath);
    $categories = array_filter(array_map('trim', explode("\n", $categoriesContent)));

    if (count($categories) !== 5) {
        echo "<span class='error'>✗ Expected 5 categories, found " . count($categories) . ", skipping...</span></p>";
        $errors++;
        continue;
    }

    // Generate game config
    $gameConfig = generateGameConfig($folderName, $categories);

    // Write game.json
    if (file_put_contents($gameJsonPath, json_encode($gameConfig, JSON_PRETTY_PRINT)) !== false) {
        echo "<span class='success'>✓ game.json created successfully!</span></p>";
        $processed++;
    } else {
        echo "<span class='error'>✗ Failed to write game.json</span></p>";
        $errors++;
    }
}

echo "<hr>";
echo "<h2>Summary</h2>";
echo "<p class='success'>✓ Processed: $processed</p>";
echo "<p class='warning'>⚠ Skipped (already exists): $skipped</p>";
echo "<p class='error'>✗ Errors: $errors</p>";

echo "</body></html>";
?>
