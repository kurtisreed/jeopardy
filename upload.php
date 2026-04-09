<?php
// upload.php
ini_set('max_execution_time', 300);
ini_set('display_errors', 1);
error_reporting(E_ALL);

if ($_SERVER['REQUEST_METHOD'] == 'POST') {
    // Buffer output to prevent any unintended output
    ob_start();

    // Check if folder name is provided
    if (isset($_POST['folder_name']) && !empty($_POST['folder_name'])) {
        $folder_name = $_POST['folder_name'];

        // Sanitize the folder name to allow spaces
        $folder_name = sanitizeFolderName($folder_name);
    } else {
        echo "Error: Folder name is required.";
        exit;
    }

    // Retrieve and sanitize category headings
    $categories = [];
    for ($i = 1; $i <= 5; $i++) {
        $key = 'category' . $i;
        if (isset($_POST[$key]) && !empty($_POST[$key])) {
            $categories[] = sanitizeCategory($_POST[$key]);
        } else {
            echo "Error: All five category headings are required.";
            exit;
        }
    }

    // Retrieve Daily Double location (default to category 4, $400 if not provided)
    $dd_category = isset($_POST['dd_category']) ? intval($_POST['dd_category']) : 4;
    $dd_value = isset($_POST['dd_value']) ? intval($_POST['dd_value']) : 400;

    // Validate DD parameters
    if ($dd_category < 1 || $dd_category > 5) {
        echo "Error: Invalid Daily Double category.";
        exit;
    }
    if (!in_array($dd_value, [100, 200, 300, 400, 500])) {
        echo "Error: Invalid Daily Double point value.";
        exit;
    }

    // Check if file was uploaded without errors
    if (isset($_FILES['pdf_file']) && $_FILES['pdf_file']['error'] == 0) {
        $filename = $_FILES['pdf_file']['name'];
        $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));

        if ($ext !== 'zip') {
            echo "Error: Please upload a ZIP file created by the convert_pdf.py script.";
            exit;
        }

        $upload_dir = 'uploads/';
        if (!is_dir($upload_dir)) {
            mkdir($upload_dir, 0755, true);
        }

        $zip_path = $upload_dir . basename($filename);

        if (move_uploaded_file($_FILES['pdf_file']['tmp_name'], $zip_path)) {
            echo "The file $filename has been uploaded successfully.<br>";
            extractZipToGame($zip_path, $folder_name, $categories, $dd_category, $dd_value);
            unlink($zip_path);
        } else {
            echo "Error: There was a problem uploading your file.";
            exit;
        }
    } else {
        echo "Error: " . $_FILES['pdf_file']['error'];
        exit;
    }

    ob_end_flush(); // Send the output buffer
}

function sanitizeFolderName($folder_name)
{
    // Remove any characters that are not letters, numbers, spaces, underscores, or hyphens
    $folder_name = preg_replace('/[^A-Za-z0-9 _\-]/', '', $folder_name);

    // Replace multiple spaces with a single space
    $folder_name = preg_replace('/\s+/', ' ', $folder_name);

    // Trim leading and trailing spaces
    $folder_name = trim($folder_name);

    // Limit the length of the folder name
    $folder_name = substr($folder_name, 0, 50);

    return $folder_name;
}

function sanitizeCategory($category)
{
    // Remove any unwanted characters
    $category = strip_tags($category); // Remove HTML tags
    $category = trim($category); // Trim leading and trailing whitespace
    $category = substr($category, 0, 100); // Limit length to 100 characters

    return $category;
}

function extractZipToGame($zip_path, $folder_name, $categories, $dd_category, $dd_value)
{
    $output_dir = 'Games/' . $folder_name . '/';
    if (!is_dir($output_dir)) {
        mkdir($output_dir, 0755, true);
    }

    $zip = new ZipArchive();
    if ($zip->open($zip_path) !== true) {
        echo "Error: Could not open ZIP file.";
        return;
    }

    // Validate: must contain exactly 53 JPEGs named 0001.jpg–0053.jpg
    $found = [];
    for ($i = 0; $i < $zip->numFiles; $i++) {
        $name = basename($zip->getNameIndex($i));
        if (preg_match('/^\d{4}\.jpg$/i', $name)) {
            $found[] = $name;
        }
    }

    if (count($found) !== 53) {
        echo "Error: ZIP should contain exactly 53 JPEG images, found " . count($found) . ". Please use the convert_pdf.py script to create the ZIP.";
        $zip->close();
        return;
    }

    // Extract only the JPEG files (ignore any extra files/folders in the zip)
    for ($i = 0; $i < $zip->numFiles; $i++) {
        $name = $zip->getNameIndex($i);
        $base = basename($name);
        if (preg_match('/^\d{4}\.jpg$/i', $base)) {
            $zip->extractTo($output_dir, $name);
            // If zipped into a subfolder, move to output_dir root
            if ($name !== $base && file_exists($output_dir . $name)) {
                rename($output_dir . $name, $output_dir . $base);
            }
        }
    }
    $zip->close();

    // Create game.json
    $game_config = generateGameConfig($folder_name, $categories, $dd_category, $dd_value);
    $game_json_file = $output_dir . 'game.json';

    if (file_put_contents($game_json_file, json_encode($game_config, JSON_PRETTY_PRINT)) !== false) {
        $categories_file = $output_dir . 'categories.txt';
        file_put_contents($categories_file, implode(PHP_EOL, $categories));
        echo "Your new Jeopardy game \"$folder_name\" has been generated successfully.";
    } else {
        echo "Error: Failed to create game.json file.";
    }
}

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
?>
