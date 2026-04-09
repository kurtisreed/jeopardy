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
        $allowed = ['pdf' => 'application/pdf'];
        $filename = $_FILES['pdf_file']['name'];
        $filetype = $_FILES['pdf_file']['type'];

        // Verify file extension
        $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
        if (!array_key_exists($ext, $allowed)) {
            echo "Error: Please select a valid PDF file.";
            exit;
        }

        // Verify file type
        if (in_array($filetype, $allowed)) {
            // Specify the path to save the uploaded PDF
            $upload_dir = 'uploads/';
            if (!is_dir($upload_dir)) {
                mkdir($upload_dir, 0755, true);
            }

            // Define the path where the PDF will be saved
            $pdf_path = $upload_dir . basename($filename);

            // Move the uploaded file to the server directory
            if (move_uploaded_file($_FILES['pdf_file']['tmp_name'], $pdf_path)) {
                echo "The file $filename has been uploaded successfully.<br>";

                // Check if the PDF has exactly 53 pages before converting
                if (checkPdfPageCount($pdf_path, 53)) {
                    // Convert PDF to JPEG images with the specified folder name
                    convertPdfToJpg($pdf_path, $folder_name, $filename, $categories, $dd_category, $dd_value);
                } else {
                    echo "Error: The PDF should have exactly 53 slides. Please use the provided Google docs template, and save as PDF.<br>";
                    // Optionally, delete the uploaded PDF if it doesn't meet the criteria
                    unlink($pdf_path);
                    echo "Uploaded file has been deleted.";
                }
            } else {
                echo "Error: There was a problem uploading your file.";
                exit;
            }
        } else {
            echo "Error: Please upload a valid PDF file.";
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

function checkPdfPageCount($pdf_path, $expected_pages)
{
    // Parse the raw PDF to count pages — more reliable than Imagick's pingImage
    // which misreports multi-page PDFs on some versions
    $content = file_get_contents($pdf_path);
    if ($content === false) {
        return false;
    }
    $num_pages = preg_match_all('/\/Type\s*\/Page[^s]/', $content);
    return $num_pages === $expected_pages;
}

function convertPdfToJpg($pdf_path, $folder_name, $original_filename, $categories, $dd_category, $dd_value)
{
    // Specify the directory to save JPEG images
    $output_dir = 'Games/' . $folder_name . '/';
    if (!is_dir($output_dir)) {
        mkdir($output_dir, 0755, true);
    }

    $imagick = new Imagick();
    $imagick->setResolution(300, 300);

    // Read the PDF into Imagick
    try {
        $imagick->readImage($pdf_path);
    } catch (Exception $e) {
        echo "Error: Could not read the PDF file.";
        return;
    }

    // Get the number of pages
    $num_pages = $imagick->getNumberImages();

    // Initialize counter for pages converted
    $pages_converted = 0;

    for ($i = 0; $i < $num_pages; $i++) {
        $imagick->setIteratorIndex($i);

        $imagick->setImageFormat('jpeg');
        $imagick->setImageCompressionQuality(90);

        $image_filename = $output_dir . sprintf('%04d.jpg', $i + 1);

        if ($imagick->writeImage($image_filename)) {
            $pages_converted++;
        } else {
            // Handle error if needed
        }
    }

    $imagick->clear();
    $imagick->destroy();

    // Create game.json file with full game configuration
    $game_config = generateGameConfig($folder_name, $categories, $dd_category, $dd_value);
    $game_json_file = $output_dir . 'game.json';

    if (file_put_contents($game_json_file, json_encode($game_config, JSON_PRETTY_PRINT)) !== false) {
        // Also create categories.txt for backward compatibility
        $categories_file = $output_dir . 'categories.txt';
        $categories_content = implode(PHP_EOL, $categories);
        file_put_contents($categories_file, $categories_content);

        // Output final statement
        echo "Your new Jeopardy game $folder_name has been generated successfully.";
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
