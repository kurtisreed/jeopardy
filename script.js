// Global Variables and Constants
let selectedFolderName = '';
let gameConfig = null; // Stores loaded game.json configuration

const gameState = {
  teams: [
    { id: 'team1', name: 'Team 1', score: 0 },
    { id: 'team2', name: 'Team 2', score: 0 },
    { id: 'team3', name: 'Team 3', score: 0 },
    { id: 'team4', name: 'Team 4', score: 0 },
  ],
  activeTeamCount: 3, // Will be set based on user selection
  usedCells: [],      // Tracks which board cells have been answered
};

// Game State Persistence
function saveGameState() {
  const stateToSave = {
    selectedFolderName,
    teams: gameState.teams.map(t => ({ ...t })),
    activeTeamCount: gameState.activeTeamCount,
    usedCells: gameState.usedCells,
    timestamp: Date.now(),
  };
  localStorage.setItem('jeopardyGameState', JSON.stringify(stateToSave));
}

function clearSavedGame() {
  localStorage.removeItem('jeopardyGameState');
  const banner = document.getElementById('resume-banner');
  if (banner) banner.style.display = 'none';
  document.getElementById('openingeditform').style.display = 'block';
}

function checkForSavedGame() {
  const saved = localStorage.getItem('jeopardyGameState');
  if (!saved) return;
  try {
    const state = JSON.parse(saved);
    const banner = document.getElementById('resume-banner');
    const info = document.getElementById('resume-info');
    if (banner && info) {
      const date = new Date(state.timestamp);
      const teamSummary = state.teams.map(t => `${t.name}: ${t.score}`).join(' | ');
      const usedCount = (state.usedCells || []).length;
      info.textContent = `Game: ${state.selectedFolderName} — ${teamSummary} — ${usedCount} question(s) answered — Saved: ${date.toLocaleString()}`;
      banner.style.display = 'block';
      document.getElementById('openingeditform').style.display = 'none';
    }
  } catch (e) {
    localStorage.removeItem('jeopardyGameState');
  }
}

async function resumeGame() {
  const saved = localStorage.getItem('jeopardyGameState');
  if (!saved) return;
  try {
    const state = JSON.parse(saved);
    selectedFolderName = state.selectedFolderName;
    gameState.teams = state.teams;
    gameState.activeTeamCount = state.activeTeamCount;
    gameState.usedCells = state.usedCells || [];
    document.getElementById('openingmodal').style.display = 'none';
    await loadGameConfig(selectedFolderName);
    generateBoard();
    preloadImages(selectedFolderName);
    updateTeamUI();
  } catch (e) {
    console.error('Failed to resume game:', e);
    clearSavedGame();
  }
}

// DOM Elements
const slide = document.getElementById('image');
const DDslide = document.getElementById('imageDD');
const fjSlide = document.getElementById('fjimage');
const newScoreForm = document.getElementById('newscore');
const openingForm = document.getElementById('openingeditform');

// Category Inputs
const categoryInputs = [
  document.querySelector('#cat1'),
  document.querySelector('#cat2'),
  document.querySelector('#cat3'),
  document.querySelector('#cat4'),
  document.querySelector('#cat5'),
];

// Event Listeners
openingForm.addEventListener('submit', handleOpeningFormSubmit);
newScoreForm.addEventListener('submit', handleNewScoreFormSubmit);

// Note: Point click handlers are now attached dynamically in generateBoard()

// Event handler functions
function handleOpeningFormSubmit(event) {
  event.preventDefault();

  selectedFolderName = document.getElementById('folder').value;

  // Get selected team count
  const teamCount = Number(document.getElementById('teamcount').value);
  gameState.activeTeamCount = teamCount;

  // Update team names and trim teams array to match selected count
  for (let i = 0; i < teamCount; i++) {
    const teamInput = document.querySelector(`#openingteam${i + 1}`);
    if (teamInput && gameState.teams[i]) {
      gameState.teams[i].name = teamInput.value;
      gameState.teams[i].score = 0; // Reset scores
    }
  }

  // Trim the teams array to only include active teams
  gameState.teams = gameState.teams.slice(0, teamCount);
  gameState.usedCells = []; // Reset used cells for new game

  console.log(`Game configured for ${teamCount} teams:`, gameState.teams);

  updateTeamUI();

  // Note: Categories are already loaded from game.json and will be set when board is generated

  document.getElementById('openingmodal').style.display = 'none';

  // Start the game AFTER team configuration
  startGame();
}

function handleNewScoreFormSubmit(event) {
  event.preventDefault();

  // Read scores from dynamically generated inputs
  gameState.teams.forEach((team, index) => {
    const input = document.getElementById(`new${team.id.slice(-1)}score`);
    if (input) {
      team.score = Number(input.value);
    }
  });
  updateTeamUI();
  saveGameState();

  // Close the modal after updating
  document.getElementById('changescore').style.display = 'none';
}

// Utility Functions
function saveCategories(folderName, categories) {
  const folderPath = `./Games/${folderName}`;
  fetch('save_categories.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folder: folderPath, categories }),
  })
    .then((response) => response.text())
    .then((data) => console.log('Server Response:', data))
    .catch((error) => console.error('Error:', error));
}

function updateTeamUI() {
  gameState.teams.forEach((team) => {
    const nameElement = document.getElementById(`${team.id}name`);
    const scoreElement = document.getElementById(`${team.id}score`);

    // Only update if elements exist (board has been generated)
    if (nameElement) nameElement.textContent = team.name;
    if (scoreElement) scoreElement.textContent = team.score;
  });

  // Update score modal team names
  gameState.teams.forEach((team, index) => {
    const modalElement = document.getElementById(`scoreModalteam${index + 1}Name`);
    if (modalElement) {
      modalElement.textContent = `${team.name} score:`;
    }
  });
}

function generateModalTeamButtons() {
  // Generate buttons for main modal
  const modalButtonsContainer = document.getElementById('modal-team-buttons');
  if (modalButtonsContainer) {
    modalButtonsContainer.innerHTML = '';
    gameState.teams.forEach((team) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn btn-primary';
      button.id = `${team.id}addvalue`;
      button.textContent = team.name;
      button.onclick = function() {
        addPoints(team.id, Number(document.getElementById('title').textContent));
      };
      modalButtonsContainer.appendChild(button);
    });
  }

  // Generate buttons for Daily Double modal
  const ddButtonsContainer = document.getElementById('dd-team-buttons');
  if (ddButtonsContainer) {
    ddButtonsContainer.innerHTML = '';
    gameState.teams.forEach((team, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn btn-gold';
      button.id = `${team.id}dd`;
      button.textContent = `${team.name} ($${team.score})`;
      button.onclick = function() {
        showDDQuestion(index);
      };
      ddButtonsContainer.appendChild(button);
    });
  }
}

function generateScoreInputs() {
  const container = document.getElementById('score-inputs-container');
  if (!container) return;

  // Clear existing inputs
  container.innerHTML = '';

  // Generate inputs for each team
  gameState.teams.forEach((team, index) => {
    const formGroup = document.createElement('div');
    formGroup.className = 'form-group';

    const label = document.createElement('label');
    label.id = `scoreModalteam${index + 1}Name`;
    label.textContent = `${team.name} Score:`;

    const input = document.createElement('input');
    input.type = 'number';
    input.name = `new${index + 1}score`;
    input.id = `new${team.id.slice(-1)}score`; // Keep old ID format for compatibility
    input.value = team.score;

    formGroup.appendChild(label);
    formGroup.appendChild(input);
    container.appendChild(formGroup);
  });
}

function updateModalTeamNames() {
  // Regenerate buttons with updated team names
  generateModalTeamButtons();
}

// Add event listeners for DDcorrect and DDincorrect buttons after the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const DDcorrectButton = document.getElementById('DDcorrect');
    const DDincorrectButton = document.getElementById('DDincorrect');

    DDcorrectButton.addEventListener('click', () => {
      DDAnswer(true);
    });

    DDincorrectButton.addEventListener('click', () => {
      DDAnswer(false);
    });
});

function showDDSplash() {
  // Generate DD team buttons with current scores
  generateModalTeamButtons();
  document.getElementById('dailydouble').style.display = 'block';
}




// Update showDDQuestion to store which team and what bid was chosen
function showDDQuestion(teamIndex) {
    // Use game config if available, otherwise fall back to hardcoded values
    const ddConfig = gameConfig?.dailyDouble || {
        questionImage: '0037.jpg',
        answerImage: '0038.jpg'
    };

    const picPath = `./Games/${selectedFolderName}/${ddConfig.questionImage}`;
    const nextPicPath = `./Games/${selectedFolderName}/${ddConfig.answerImage}`;
    dailyDoubleTeamIndex = teamIndex;
    dailyDoubleBid = Number(document.getElementById('ddamount').value);

    const thisTeam = gameState.teams[teamIndex].name;
    document.getElementById('titleDD').textContent = 'Daily Double - ' + thisTeam + ' - ' + dailyDoubleBid + ' points';
    document.getElementById('dailydouble').style.display = 'none';
    DDslide.src = picPath;
    DDslide.dataset.nextslide = nextPicPath;



    document.getElementById('DDcorrect').style.visibility = 'hidden';
    document.getElementById('DDincorrect').style.visibility = 'hidden';
    document.getElementById('modalDD').style.display = 'block';
    updateModalTeamNames();
}

function DDAnswer(isCorrect) {
    // Add or subtract the bid from the current team's score
    if (dailyDoubleTeamIndex !== null) {
        if (isCorrect) {
            gameState.teams[dailyDoubleTeamIndex].score += dailyDoubleBid;
        } else {
            gameState.teams[dailyDoubleTeamIndex].score -= dailyDoubleBid;
        }
        updateTeamUI();
        saveGameState();
    }

    // Reset daily double tracking variables
    dailyDoubleTeamIndex = null;
    dailyDoubleBid = 0;

    // Close the DD modal
    document.getElementById('modalDD').style.display = 'none';
}

function addTeamValue(teamId, value) {
  const team = gameState.teams.find((t) => t.id === teamId);
  if (team) {
    team.score += Number(value);
    updateTeamUI();
    document.getElementById('modal01').style.display = 'none';
  } else {
    console.error(`Team with ID ${teamId} not found.`);
  }
}

function openModal(value, pic, nextPic) {
  const picPath = `./Games/${selectedFolderName}/${pic}`;
  const nextPicPath = `./Games/${selectedFolderName}/${nextPic}`;

  document.getElementById('title').textContent = value;
  slide.src = picPath;
  slide.dataset.nextslide = nextPicPath;
  document.getElementById('modal01').style.display = 'block';

  // Generate team buttons dynamically
  generateModalTeamButtons();

  // Reset visibility
  document.getElementById('answer').style.visibility = 'visible';
  document.getElementById('nopointsbutton').style.visibility = 'hidden';

  // Hide team buttons initially
  const modalButtonsContainer = document.getElementById('modal-team-buttons');
  if (modalButtonsContainer) {
    modalButtonsContainer.style.visibility = 'hidden';
  }
}

function showAnswer(event) {
  slide.src = slide.dataset.nextslide;
  event.stopPropagation();

  document.getElementById('answer').style.visibility = 'hidden';
  document.getElementById('nopointsbutton').style.visibility = 'visible';

  // Show team buttons
  const modalButtonsContainer = document.getElementById('modal-team-buttons');
  if (modalButtonsContainer) {
    modalButtonsContainer.style.visibility = 'visible';
  }
}

function showAnswerForDD(event) {
    DDslide.src = DDslide.dataset.nextslide;
    event.stopPropagation();
    
    document.getElementById('DDanswer').style.visibility = 'hidden';
    document.getElementById('DDcorrect').style.visibility = 'visible';
    document.getElementById('DDincorrect').style.visibility = 'visible';
}

function openFJModal() {
  // Use game config if available, otherwise fall back to hardcoded values
  const fjConfig = gameConfig?.finalJeopardy || {
    categoryImage: '0051.jpg',
    clueImage: '0052.jpg',
    answerImage: '0053.jpg'
  };

  const fjPicName = `./Games/${selectedFolderName}/${fjConfig.categoryImage}`;
  fjSlide.src = fjPicName;
  fjSlide.dataset.clueImage = fjConfig.clueImage;
  fjSlide.dataset.answerImage = fjConfig.answerImage;
  document.getElementById('fjmodal').style.display = 'block';

  document.getElementById('fjclue').style.visibility = 'visible';
  document.getElementById('fjanswer').style.visibility = 'hidden';
  document.getElementById('fjpoints').style.visibility = 'hidden';
}

function showFJClue(event) {
  const clueImage = fjSlide.dataset.clueImage || '0052.jpg';
  fjSlide.src = `./Games/${selectedFolderName}/${clueImage}`;
  event.stopPropagation();

  document.getElementById('fjclue').style.visibility = 'hidden';
  document.getElementById('fjanswer').style.visibility = 'visible';
}

function showFJAnswer(event) {
  const answerImage = fjSlide.dataset.answerImage || '0053.jpg';
  fjSlide.src = `./Games/${selectedFolderName}/${answerImage}`;
  event.stopPropagation();

  document.getElementById('fjanswer').style.visibility = 'hidden';
  document.getElementById('fjpoints').style.visibility = 'visible';
}

function points() {
  const fjConfig = gameConfig?.finalJeopardy || { categoryImage: '0051.jpg' };
  fjSlide.src = `./Games/${selectedFolderName}/${fjConfig.categoryImage}`;
  document.getElementById('fjmodal').style.display = 'none';
  openFJScoring();
}

const fjState = { correct: {} };

function openFJScoring() {
  const container = document.getElementById('fj-team-inputs');
  container.innerHTML = '';

  // Reset result state
  gameState.teams.forEach(team => { fjState.correct[team.id] = null; });

  gameState.teams.forEach(team => {
    const card = document.createElement('div');
    card.className = 'fj-team-card';
    card.innerHTML = `
      <div class="fj-team-header">
        <span class="fj-team-name">${team.name} — ${team.score}</span>
      </div>
      <div class="fj-team-controls">
        <div class="form-group" style="flex:1; margin-bottom:0;">
          <label>Wager</label>
          <input type="number" id="fj-wager-${team.id}" min="0" value="0" placeholder="Enter wager">
        </div>
        <div style="display:flex; flex-direction:column; gap:0.5rem; align-items:center;">
          <label>Result</label>
          <div style="display:flex; gap:0.5rem;">
            <button type="button" class="btn fj-correct-btn" id="fj-correct-${team.id}" onclick="setFJResult('${team.id}', true)">Correct</button>
            <button type="button" class="btn fj-incorrect-btn" id="fj-incorrect-${team.id}" onclick="setFJResult('${team.id}', false)">Wrong</button>
          </div>
        </div>
      </div>
    `;
    container.appendChild(card);
  });

  document.getElementById('fj-wager-section').style.display = 'block';
  document.getElementById('fj-results-section').style.display = 'none';
  document.getElementById('fj-scoring-modal').style.display = 'block';
}

function setFJResult(teamId, isCorrect) {
  fjState.correct[teamId] = isCorrect;
  document.getElementById(`fj-correct-${teamId}`).classList.toggle('active-correct', isCorrect);
  document.getElementById(`fj-incorrect-${teamId}`).classList.toggle('active-incorrect', !isCorrect);
}

function calculateFJResults() {
  gameState.teams.forEach(team => {
    const wager = Number(document.getElementById(`fj-wager-${team.id}`)?.value || 0);
    const isCorrect = fjState.correct[team.id];
    if (isCorrect === true)  team.score += wager;
    if (isCorrect === false) team.score -= wager;
  });
  updateTeamUI();
  saveGameState();
  showFJWinner();
}

function showFJWinner() {
  document.getElementById('fj-wager-section').style.display = 'none';
  document.getElementById('fj-results-section').style.display = 'block';

  const sorted = [...gameState.teams].sort((a, b) => b.score - a.score);
  const winner = sorted[0];

  document.getElementById('fj-winner-display').innerHTML = `
    <div class="fj-winner-banner">
      <div class="fj-winner-label">Winner!</div>
      <div class="fj-winner-name">${winner.name}</div>
      <div class="fj-winner-final-score">${winner.score} points</div>
    </div>
  `;

  const medals = ['🥇', '🥈', '🥉', '4️⃣'];
  document.getElementById('fj-final-standings').innerHTML = `
    <h3 style="color:var(--text-secondary); margin-bottom:1rem; font-size:0.9rem; text-transform:uppercase; letter-spacing:1px;">Final Standings</h3>
    ${sorted.map((team, i) => `
      <div class="fj-standing-row ${i === 0 ? 'fj-standing-first' : ''}">
        <span class="fj-standing-medal">${medals[i] || ''}</span>
        <span class="fj-standing-name">${team.name}</span>
        <span class="fj-standing-score">${team.score}</span>
      </div>
    `).join('')}
  `;

  launchConfetti();
}

function launchConfetti() {
  const container = document.getElementById('fj-confetti-container');
  container.innerHTML = '';
  const colors = ['#FFCC00', '#060CE9', '#ff4757', '#00d4aa', '#ffffff', '#ffd700'];
  for (let i = 0; i < 70; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.cssText = `
      left: ${Math.random() * 100}%;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      width: ${5 + Math.random() * 8}px;
      height: ${5 + Math.random() * 10}px;
      animation-delay: ${Math.random() * 2.5}s;
      animation-duration: ${2 + Math.random() * 2.5}s;
      border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
    `;
    container.appendChild(piece);
  }
}

function openScoreModal() {
  document.getElementById('changescore').style.display = 'block';

  // Generate score inputs with current scores
  generateScoreInputs();

  updateTeamUI();
}

function openingModal() {
  document.getElementById('openingmodal').style.display = 'block';
  populateTeamNames();

  // Add event listener for team count selector
  const teamCountSelect = document.getElementById('teamcount');
  if (teamCountSelect) {
    teamCountSelect.addEventListener('change', updateTeamInputsVisibility);
    // Initialize visibility
    updateTeamInputsVisibility();
  }
}

function updateTeamInputsVisibility() {
  const teamCountSelect = document.getElementById('teamcount');
  const teamNamesSection = document.getElementById('team-names-section');

  if (!teamCountSelect || !teamNamesSection) return;

  const teamCount = Number(teamCountSelect.value);

  // Show/hide the entire Step 3 section
  if (teamCount > 0) {
    teamNamesSection.style.display = 'block';
  } else {
    teamNamesSection.style.display = 'none';
    return;
  }

  // Show/hide individual team inputs based on count
  for (let i = 1; i <= 4; i++) {
    const input = document.getElementById(`openingteam${i}`);
    if (!input) continue;

    // Find the parent form-group
    const formGroup = input.closest('.form-group');
    if (!formGroup) continue;

    if (i <= teamCount) {
      formGroup.style.display = 'block';
      input.required = true;
    } else {
      formGroup.style.display = 'none';
      input.required = false;
      input.value = ''; // Clear value when hidden
    }
  }
}

function populateTeamNames() {
  // Only populate up to 4 teams (the max we support)
  for (let i = 0; i < Math.min(4, gameState.teams.length); i++) {
    const input = document.getElementById(`openingteam${i + 1}`);
    if (input && gameState.teams[i]) {
      input.value = gameState.teams[i].name;
    }
  }
}

function preloadImages(folderName) {
  const totalImages = 53;
  for (let i = 1; i <= totalImages; i++) {
    const imageNumber = i.toString().padStart(4, '0');
    const imgSrc = `./Games/${folderName}/${imageNumber}.jpg`;
    const img = new Image();
    img.src = imgSrc;
  }
}

function fitTextToCell(element, maxFontSize = 32) {
  // Get the text content length
  const text = element.textContent;
  const textLength = text.length;

  // Start with max font size
  let fontSize = maxFontSize;

  // Adjust font size based on text length
  if (textLength > 20) {
    fontSize = Math.max(16, maxFontSize - ((textLength - 20) * 0.8));
  }

  element.style.fontSize = fontSize + 'px';

  // Check if text is still overflowing and reduce further if needed
  if (element.scrollHeight > element.clientHeight || element.scrollWidth > element.clientWidth) {
    fontSize = fontSize * 0.8;
    element.style.fontSize = fontSize + 'px';
  }
}

function generateLegacyBoard() {
  console.log('Generating board using legacy hardcoded pattern');
  const grid = document.querySelector('.grid');
  if (!grid) {
    console.error('Grid element not found');
    return;
  }

  grid.innerHTML = '';

  // Hardcoded categories (will be updated by loadCategories)
  for (let i = 1; i <= 5; i++) {
    const catDiv = document.createElement('div');
    catDiv.className = 'cell category';
    catDiv.id = `cat${i}name`;
    grid.appendChild(catDiv);
  }

  // Fit text to category cells after they're added and populated
  setTimeout(() => {
    for (let i = 1; i <= 5; i++) {
      const catElement = document.getElementById(`cat${i}name`);
      if (catElement && catElement.textContent) {
        fitTextToCell(catElement);
      }
    }
  }, 100);

  const teamCount = gameState.teams.length;
  const pointValues = [100, 200, 300, 400, 500];
  let imageCounter = 1;

  // Generate questions and team cells row by row
  for (let rowIndex = 0; rowIndex < 5; rowIndex++) {
    const pointValue = pointValues[rowIndex];

    // Add team cell at start of first N rows (where N = teamCount)
    if (rowIndex < teamCount) {
      const team = gameState.teams[rowIndex];
      const teamCell = document.createElement('div');
      teamCell.className = 'cell misctest';
      teamCell.innerHTML = `<div><span id="${team.id}name">${team.name}</span><br><span class="scorearea" id="${team.id}score" onclick="openScoreModal()">${team.score}</span></div>`;
      grid.appendChild(teamCell);
    } else {
      // Empty cell or Final Jeopardy button
      if (rowIndex === 4) {
        const fjCell = document.createElement('div');
        fjCell.className = 'cell misc fj';
        fjCell.textContent = 'Final Jeopardy';
        fjCell.onclick = openFJModal;
        grid.appendChild(fjCell);
      } else {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'cell misc';
        grid.appendChild(emptyCell);
      }
    }

    // Generate question cells for this row
    for (let colIndex = 0; colIndex < 5; colIndex++) {
      const questionImage = String(imageCounter).padStart(4, '0') + '.jpg';
      const answerImage = String(imageCounter + 1).padStart(4, '0') + '.jpg';

      const cellDiv = document.createElement('div');
      cellDiv.className = 'cell point';
      cellDiv.setAttribute('data-value', pointValue);
      cellDiv.textContent = pointValue;

      const cellId = `cell-cat${colIndex + 1}-${pointValue}`;
      cellDiv.id = cellId;
      if (gameState.usedCells.includes(cellId)) {
        cellDiv.classList.add('used');
      }

      // Hardcoded DD location: Category 4, $400 (image 0037)
      if (colIndex === 3 && pointValue === 400) {
        cellDiv.onclick = function() {
          this.classList.add('used');
          if (!gameState.usedCells.includes(cellId)) gameState.usedCells.push(cellId);
          saveGameState();
          showDDSplash();
        };
      } else {
        cellDiv.onclick = function() {
          this.classList.add('used');
          if (!gameState.usedCells.includes(cellId)) gameState.usedCells.push(cellId);
          saveGameState();
          openModal(pointValue, questionImage, answerImage);
        };
      }

      grid.appendChild(cellDiv);
      imageCounter += 2;
    }
  }

  console.log(`Legacy board generated with ${teamCount} teams`);
}

function generateBoard() {
  if (!gameConfig) {
    console.warn('Game config not available, using legacy board generation');
    generateLegacyBoard();
    return;
  }

  const grid = document.querySelector('.grid');
  if (!grid) {
    console.error('Grid element not found');
    return;
  }

  // Clear existing board (except we'll regenerate it)
  grid.innerHTML = '';

  // Get DD location from config
  const ddCategory = gameConfig.dailyDouble.category;
  const ddValue = gameConfig.dailyDouble.pointValue;

  console.log('Generating board with DD at:', `Category ${ddCategory}, $${ddValue}`);

  // Generate category headers
  gameConfig.categories.forEach((category, index) => {
    const catDiv = document.createElement('div');
    catDiv.className = 'cell category';
    catDiv.id = `cat${index + 1}name`;
    catDiv.textContent = category;
    grid.appendChild(catDiv);

    // Fit text to category cell
    setTimeout(() => fitTextToCell(catDiv), 0);
  });

  const teamCount = gameState.teams.length;

  // Generate question cells and team cells row by row
  for (let rowIndex = 0; rowIndex < 5; rowIndex++) {
    const pointValue = gameConfig.pointValues[rowIndex];

    // Add team cell at start of first N rows (where N = teamCount)
    if (rowIndex < teamCount) {
      const team = gameState.teams[rowIndex];
      const teamCell = document.createElement('div');
      teamCell.className = 'cell misctest';
      teamCell.innerHTML = `<div><span id="${team.id}name">${team.name}</span><br><span class="scorearea" id="${team.id}score" onclick="openScoreModal()">${team.score}</span></div>`;
      grid.appendChild(teamCell);
    } else {
      // Empty cell or Final Jeopardy button
      if (rowIndex === 4) {
        const fjCell = document.createElement('div');
        fjCell.className = 'cell misc fj';
        fjCell.textContent = 'Final Jeopardy';
        fjCell.onclick = openFJModal;
        grid.appendChild(fjCell);
      } else {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'cell misc';
        grid.appendChild(emptyCell);
      }
    }

    // Generate question cells for this row
    for (let colIndex = 0; colIndex < 5; colIndex++) {
      const category = colIndex + 1;
      const catKey = `cat${category}`;
      const questionData = gameConfig.questions[catKey]?.[pointValue];

      if (!questionData) {
        console.warn(`Missing question data for ${catKey} ${pointValue}`);
        continue;
      }

      const cellDiv = document.createElement('div');
      cellDiv.className = 'cell point';
      cellDiv.setAttribute('data-value', pointValue);
      cellDiv.textContent = pointValue;

      const cellId = `cell-cat${category}-${pointValue}`;
      cellDiv.id = cellId;
      if (gameState.usedCells.includes(cellId)) {
        cellDiv.classList.add('used');
      }

      // Check if this is the Daily Double location
      if (category === ddCategory && pointValue === ddValue) {
        cellDiv.onclick = function() {
          this.classList.add('used');
          if (!gameState.usedCells.includes(cellId)) gameState.usedCells.push(cellId);
          saveGameState();
          showDDSplash();
        };
      } else {
        cellDiv.onclick = function() {
          this.classList.add('used');
          if (!gameState.usedCells.includes(cellId)) gameState.usedCells.push(cellId);
          saveGameState();
          openModal(pointValue, questionData.question, questionData.answer);
        };
      }

      grid.appendChild(cellDiv);
    }
  }

  console.log(`Board generated successfully with ${teamCount} teams and DD at Category ${ddCategory}, $${ddValue}`);
}

function startGame() {
  document.getElementById('openingmodal').style.display = 'none';

  // Generate the board dynamically (will use config if available, otherwise legacy)
  generateBoard();

  preloadImages(selectedFolderName);
  saveGameState();
}

async function loadGameConfig(folderName) {
  // Add cache-busting parameter to ensure fresh load
  const configPath = `./Games/${folderName}/game.json?t=${Date.now()}`;
  try {
    const response = await fetch(configPath, { cache: 'no-store' });
    if (response.ok) {
      gameConfig = await response.json();
      console.log('Loaded game config:', gameConfig);
      console.log('Daily Double location:', `Category ${gameConfig.dailyDouble.category}, $${gameConfig.dailyDouble.pointValue}`);

      // Categories will be used when board is generated
      return true;
    } else {
      console.warn('game.json not found, falling back to categories.txt');
      return false;
    }
  } catch (error) {
    console.error('Error loading game.json:', error);
    return false;
  }
}

async function loadCategories(folderName) {
  const catNamesPath = `./Games/${folderName}/categories.txt`;
  try {
    const response = await fetch(catNamesPath);
    if (response.ok) {
      const text = await response.text();
      const categories = text.trim().split('\n').slice(0, 5);

      // Store categories in a simple format for legacy board generation
      // This will be used when board is generated
      console.log('Loaded categories from categories.txt:', categories);
    } else {
      console.error('Failed to fetch categories.txt');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

async function loadSubfolders() {
  try {
    const response = await fetch('subfolders.php');
    const subfoldersHtml = await response.text();
    document.getElementById('subfolder-container').innerHTML = subfoldersHtml;

    document.getElementById('folder').addEventListener('change', async function () {
      selectedFolderName = this.value;
      const gameConfigSection = document.getElementById('game-config-section');

      if (selectedFolderName === 'new-game') {
        document.getElementById('openingmodal').style.display = 'none';
        document.getElementById('uploadModal').style.display = 'block';
        return;
      }

      if (selectedFolderName) {
        // Try loading game.json first, fall back to categories.txt
        const configLoaded = await loadGameConfig(selectedFolderName);
        if (!configLoaded) {
          loadCategories(selectedFolderName);
        }

        // Show Step 2 (team configuration)
        if (gameConfigSection) {
          gameConfigSection.style.display = 'block';
        }
      } else {
        // Hide Steps 2 and 3 if no game selected
        if (gameConfigSection) {
          gameConfigSection.style.display = 'none';
        }
      }
    });
  } catch (error) {
    console.error('Error:', error);
  }
}

async function convertPdfToZip(pdfFile, onProgress) {
  const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const SCALE = 300 / 72; // 300 DPI
  const EXPECTED_PAGES = 53;

  pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;

  const arrayBuffer = await pdfFile.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  if (pdf.numPages !== EXPECTED_PAGES) {
    throw new Error(`PDF has ${pdf.numPages} pages — expected ${EXPECTED_PAGES}. Please use the Jeopardy template with all slides filled in.`);
  }

  const zip = new JSZip();

  for (let i = 1; i <= EXPECTED_PAGES; i++) {
    onProgress(i, EXPECTED_PAGES);

    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: SCALE });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;

    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.90));
    zip.file(`${String(i).padStart(4, '0')}.jpg`, await blob.arrayBuffer());

    // Free canvas memory before next page
    canvas.width = 0;
    canvas.height = 0;
  }

  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

async function handleUploadFormSubmit(event) {
  event.preventDefault();

  const statusDiv = document.getElementById('status');
  const spinner = document.getElementById('upload-spinner');
  const spinnerText = document.getElementById('upload-spinner-text');
  const progressBarContainer = document.getElementById('upload-progress-bar-container');
  const progressBar = document.getElementById('upload-progress-bar');
  const uploadButton = document.getElementById('upload-submit-btn');
  const doneButton = document.getElementById('upload-done-btn');

  statusDiv.textContent = '';
  statusDiv.className = '';
  spinner.classList.remove('hidden');
  if (uploadButton) uploadButton.disabled = true;

  try {
    const formData = new FormData(event.target);
    const pdfFile = formData.get('pdf_file');

    if (pdfFile.name.toLowerCase().endsWith('.pdf')) {
      // Client-side PDF → ZIP conversion
      spinnerText.textContent = 'Reading PDF...';
      progressBarContainer.style.display = 'block';
      progressBar.style.width = '0%';

      const zipBlob = await convertPdfToZip(pdfFile, (page, total) => {
        spinnerText.textContent = `Rendering page ${page} of ${total}...`;
        progressBar.style.width = `${Math.round((page / total) * 90)}%`;
      });

      spinnerText.textContent = 'Uploading...';
      progressBar.style.width = '95%';

      formData.delete('pdf_file');
      formData.append('pdf_file', zipBlob, pdfFile.name.replace(/\.pdf$/i, '.zip'));
    } else {
      spinnerText.textContent = 'Uploading...';
    }

    const response = await fetch('upload.php', { method: 'POST', body: formData });
    if (!response.ok) throw new Error(`Server error: ${response.status}`);
    const data = await response.text();

    progressBar.style.width = '100%';
    setTimeout(() => {
      spinner.classList.add('hidden');
      progressBarContainer.style.display = 'none';
    }, 400);

    statusDiv.innerHTML = data;
    const isError = data.toLowerCase().includes('error');
    statusDiv.className = isError ? 'status-message error' : 'status-message success';
    if (!isError) {
      if (uploadButton) uploadButton.classList.add('hidden');
      if (doneButton) doneButton.classList.remove('hidden');
    }
  } catch (error) {
    spinner.classList.add('hidden');
    progressBarContainer.style.display = 'none';
    statusDiv.textContent = `An error occurred: ${error.message}`;
    statusDiv.className = 'status-message error';
  } finally {
    if (uploadButton) uploadButton.disabled = false;
  }
}

function returnToOpening() {
  loadSubfolders();
  document.getElementById('openingmodal').style.display = 'block';
  document.getElementById('uploadModal').style.display = 'none';
  // Reset upload form button state for next use
  const submitBtn = document.getElementById('upload-submit-btn');
  const doneBtn = document.getElementById('upload-done-btn');
  if (submitBtn) submitBtn.classList.remove('hidden');
  if (doneBtn) doneBtn.classList.add('hidden');
}

function addPoints(teamId, points) {
  const team = gameState.teams.find((t) => t.id === teamId);
  if (team) {
    team.score += Number(points);
    updateTeamUI();
    saveGameState();
  } else {
    console.error(`Team with ID ${teamId} not found.`);
  }
}



// Authentication handling
document.addEventListener('DOMContentLoaded', () => {
  const authForm = document.getElementById('auth-form');
  const appContent = document.getElementById('app-content');
  const authMessage = document.getElementById('auth-message');

  authForm.addEventListener('submit', (event) => {
    event.preventDefault();

    const formData = new FormData(authForm);
    fetch('authenticate.php', {
      method: 'POST',
      body: formData,
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          appContent.style.display = 'block';
          document.getElementById('auth-container').style.display = 'none';
        } else {
          authMessage.textContent = 'Invalid PIN. Please try again.';
        }
      })
      .catch((error) => console.error('Error:', error));
  });
});

// Initialization
window.addEventListener('load', () => {
  loadSubfolders();
  openingModal();
  updateTeamUI();
  checkForSavedGame();

  document.getElementById('uploadForm').addEventListener('submit', handleUploadFormSubmit);
});
