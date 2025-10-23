# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a web-based Jeopardy game application built with vanilla JavaScript, HTML, CSS, and PHP. It allows users to host interactive Jeopardy games by uploading PDF game files or selecting from previously created games. The application manages team scoring, displays questions/answers as images, and handles special Jeopardy features like Daily Double and Final Jeopardy.

## Architecture

### Frontend (script.js)
- **State Management**: Single `gameState` object tracks 2-3 teams with names and scores
- **Dynamic Board Generation**: Game board is generated at runtime from game.json configuration
  - `generateBoard()` - Reads game.json and creates board with correct DD location
  - `generateLegacyBoard()` - Fallback for games without game.json (uses hardcoded pattern)
  - Board structure, point values, and click handlers are all created dynamically
  - Daily Double automatically placed in correct category/value based on config
- **Modal System**: Multiple overlapping modal workflows:
  - Main game modal (`modal01`) - regular questions with question/answer image pairs
  - Daily Double modal (`modalDD`) - shows DD splash, handles bids, and correct/incorrect responses
  - Final Jeopardy modal (`fjmodal`) - three-step progression (category → clue → answer)
  - Score editing modal (`changescore`) - manual score adjustments
  - Opening modal (`openingmodal`) - game setup and configuration
  - Upload modal (`uploadModal`) - new game creation with DD location selector
- **Image-based gameplay**: Questions and answers are JPEG images loaded from `./Games/{folderName}/` directories
- **Dynamic team support**: UI automatically adjusts for 2 or 3 teams by removing elements with `.remove` class

### Backend (PHP)
- **upload.php**: Processes PDF uploads, validates 53-page requirement, converts to JPEGs using ImageMagick
- **save_categories.php**: Saves category names to `categories.txt` in game folders
- **subfolders.php**: Dynamically generates dropdown of available games from `./Games/` directory
- **authenticate.php**: Simple PIN-based authentication (PIN: 1640 hardcoded in file)

### File Structure Convention
Each game in `./Games/{gameName}/` contains:
- `0001.jpg` through `0053.jpg` - question/answer image pairs
- `game.json` - **Primary configuration file** (automatically generated)
- `categories.txt` - Legacy format, maintained for backward compatibility

#### game.json Structure
The primary game configuration file with complete metadata:
```json
{
  "version": "1.0",
  "name": "Game Name",
  "categories": ["Category 1", "Category 2", "Category 3", "Category 4", "Category 5"],
  "pointValues": [100, 200, 300, 400, 500],
  "dailyDouble": {
    "enabled": true,
    "category": 4,
    "pointValue": 400,
    "questionImage": "0037.jpg",
    "answerImage": "0038.jpg"
  },
  "finalJeopardy": {
    "enabled": true,
    "categoryImage": "0051.jpg",
    "clueImage": "0052.jpg",
    "answerImage": "0053.jpg"
  },
  "questions": {
    "cat1": {
      "100": {"question": "0001.jpg", "answer": "0002.jpg"},
      "200": {"question": "0003.jpg", "answer": "0004.jpg"}
      // ... etc for all point values
    }
    // ... etc for cat2-cat5
  }
}
```

#### Image Numbering Pattern (Legacy)
- Odd numbers (0001, 0003, etc.) = questions
- Even numbers (0002, 0004, etc.) = answers
- Images 0001-0010: Category 1 (100-500 points)
- Images 0011-0020: Category 2
- Images 0021-0030: Category 3
- Images 0031-0040: Category 4
- Images 0041-0050: Category 5
- Image 0037: Daily Double question (default location)
- Image 0038: Daily Double answer
- Images 0051-0053: Final Jeopardy (category, clue, answer)

### Key Functions and Their Purposes

**Game Initialization:**
- `loadSubfolders()` - Fetches available games via PHP
- `loadGameConfig()` - **Primary loader**: Loads game.json configuration file with all metadata
- `loadCategories()` - **Fallback loader**: Loads category names from categories.txt (legacy support)
- `preloadImages()` - Preloads all 53 images when game starts
- `startGame()` - Closes opening modal and initiates preloading

**Modal Management:**
- `openModal(value, pic, nextPic)` - Opens question modal with point value and image paths
- `showAnswer(event)` - Switches to answer image, reveals team buttons
- `showDDSplash()` - Displays Daily Double splash screen with team scores
- `showDDQuestion(teamIndex)` - Shows DD question after team/bid selection
- `DDAnswer(isCorrect)` - Applies bid to team score based on correctness
- `openFJModal()` → `showFJClue()` → `showFJAnswer()` → `points()` - Final Jeopardy sequence

**Scoring:**
- `addPoints(teamId, points)` - Adds points to specific team
- `updateTeamUI()` - Syncs all score displays with gameState
- `updateModalTeamNames()` - Updates team names in modal buttons

**Special Behaviors:**
- Clicking a `.point` div marks it with `.used` class to track answered questions
- Team 3 removal: If `#openingteam3` is empty on form submit, all `.remove` elements are deleted and `gameState.teams` is reduced to 2 teams
- Daily Double is hardcoded to the 4th column, 4th row (400 point value in category 4)

## Development Notes

### Testing
There is no automated test suite. Manual testing involves:
1. Starting a game with the opening modal
2. Clicking through questions to verify image loading
3. Testing Daily Double functionality (hardcoded at specific location)
4. Testing Final Jeopardy progression
5. Verifying score tracking for 2 and 3 team configurations

### Running the Application
This requires a PHP-enabled web server with ImageMagick PHP extension:
```bash
php -S localhost:8000
```
Then navigate to `http://localhost:8000/index.html`

### Creating New Games
1. Use the provided Google Slides template (link in upload modal)
2. Create exactly 53 slides following the image numbering convention
3. Export as PDF
4. Upload via the application's upload modal:
   - Enter game name
   - Enter all 5 category names
   - **Select Daily Double location** (category and point value dropdowns)
   - Upload PDF file
5. The PHP backend:
   - Validates 53-page requirement
   - Converts PDF pages to numbered JPEGs using ImageMagick
   - Generates game.json with custom DD location
   - Creates categories.txt for backward compatibility

### Migrating Existing Games to game.json
For games created before the game.json system:
1. Run the migration utility: `php generate_game_configs.php`
2. Or access via browser: `http://localhost:8000/generate_game_configs.php`
3. The script will:
   - Scan all folders in `./Games/`
   - Read existing `categories.txt` files
   - Generate `game.json` for each game (skips if already exists)
   - Provide a summary report

### Important Constraints
- PDF uploads MUST have exactly 53 pages (validated in `checkPdfPageCount()`)
- Daily Double location is **fully configurable**:
  - Selected during PDF upload via dropdown in upload modal
  - Stored in game.json configuration file
  - Board is dynamically generated with DD in correct location
  - No manual HTML editing required
- Authentication PIN is hardcoded in `authenticate.php:5`
- Image resolution set to 300 DPI in `upload.php:148`
- Maximum folder name length: 50 characters (sanitized in `upload.php:100`)
- Game config system is **backward compatible**: Falls back to categories.txt and legacy board generation if game.json missing

### Common Issues
- If images don't load, verify the `selectedFolderName` variable is set correctly
- If Daily Double doesn't work:
  - Check that the images specified in game.json `dailyDouble` section exist
  - Default: 0037.jpg (question) and 0038.jpg (answer)
  - Verify game.json was loaded (check browser console for "Loaded game config" message)
- If categories don't appear, check that either game.json or categories.txt exists in the game folder
- If team 3 UI elements persist when only 2 teams are specified, ensure the team name input is completely empty (not just whitespace)
- ImageMagick must be installed and the PHP `imagick` extension enabled for PDF uploads to work
- For debugging: Open browser console to see which config system is being used (game.json or categories.txt fallback)
