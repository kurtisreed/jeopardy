<?php
$directory = './'; // Change this to your folder path
$subfolders = array_filter(glob($directory . '/Games/*'), 'is_dir');

echo '<select name="folder" id="folder" class="w3-input w3-border w3-margin-bottom">';
echo '<option value="">Select Jeopardy Game</option>';

foreach ($subfolders as $folder) {
    $folderName = basename($folder);
    echo '<option value="' . htmlspecialchars($folderName) . '">' . htmlspecialchars($folderName) . '</option>';
}

echo '<option value="new-game" id="upload-new-game">Upload new game</option>';

echo '</select>';
?>
