const socket = new WebSocket('wss://nosch.uber.space/web-rooms/');
const roomName = 'carquiz';

let questionElem = document.getElementById('question-container');
let infoElem = document.getElementById('info-container');
let imageElem = document.getElementById('part-image');
let labelElem = document.getElementById('part-label');
let yesBtn = document.getElementById('yes-btn');
let noBtn = document.getElementById('no-btn');
const leaderboardElem = document.getElementById('leaderboard');
let scoreDisplay = document.getElementById('score-display');
const restartBtn = document.getElementById('restart-btn');
const indexElem = document.getElementById('client-index');

let clientId = null;
let clientCount = 0;
let currentQuestion = 0;
let answered = false;
let localScore = 0;
let scores = {};
let timer;

const questions = [
  { image: 'assets/images/teil1.jpg', label: 'Zündkerze', correct: true },
  { image: 'assets/images/teil2.jpg', label: 'Lichtmaschine', correct: false },
  { image: 'assets/images/teil3.jpg', label: 'Keilriemen', correct: true },
  { image: 'assets/images/teil4.jpg', label: 'Turbolader', correct: false }
];

// Sendet Nachricht an Server
function sendMessage(selector, data) {
  socket.send(JSON.stringify([selector, data]));
}

// Zeigt eine Frage an
function showQuestion(index) {
  const q = questions[index];
  imageElem.src = q.image;
  labelElem.textContent = q.label;
  answered = false;
  yesBtn.disabled = false;
  noBtn.disabled = false;
  yesBtn.classList.remove('selected');
  noBtn.classList.remove('selected');
}

// Antwortverarbeitung
function handleAnswer(isYes) {
  if (answered) return;
  answered = true;

  const correct = questions[currentQuestion].correct;
  const isCorrect = isYes === correct;

  localScore += isCorrect ? 100 : -50;
  scoreDisplay.textContent = localScore;
  scores[clientId] = localScore;
  updateLeaderboard();

  sendMessage('*broadcast-message*', ['*score-update*', [clientId, localScore]]);

  const selectedBtn = isYes ? yesBtn : noBtn;
  selectedBtn.classList.add('selected');
  yesBtn.disabled = true;
  noBtn.disabled = true;
}

// Startet das Quiz
function startQuiz() {
  currentQuestion = 0;
  localScore = 0;
  scores[clientId] = 0;
  scoreDisplay.textContent = localScore;
  sendMessage('*broadcast-message*', ['*score-update*', [clientId, 0]]);
  updateLeaderboard();
  restartBtn.style.display = 'none';
  showQuestion(currentQuestion);

  timer = setInterval(() => {
    currentQuestion++;
    if (currentQuestion >= questions.length) {
      clearInterval(timer);
      showGameOver();
    } else {
      showQuestion(currentQuestion);
    }
  }, 8000);
}

// Spielende
function showGameOver() {
  questionElem.innerHTML = '<div class="game-over-text">GAME OVER</div>';
  infoElem.innerHTML = `<p>Dein Punktestand: ${localScore}</p>`;
  document.querySelector('.button-box').innerHTML = '';
  restartBtn.style.display = 'block';
  updateLeaderboard();
}

// Startet das Spiel neu
function resetGame() {
  currentQuestion = 0;
  localScore = 0;
  scores[clientId] = 0;
  scoreDisplay.textContent = localScore;

  infoElem.innerHTML = `Punkte: <span id="score-display">${localScore}</span>`;
  scoreDisplay = document.getElementById('score-display');

  questionElem.innerHTML = `
    <img id="part-image" src="" alt="Autoteil" />
    <p id="part-label">Warte auf Start …</p>
  `;
  imageElem = document.getElementById('part-image');
  labelElem = document.getElementById('part-label');

  const buttonBox = document.querySelector('.button-box');
  buttonBox.innerHTML = `
    <button id="yes-btn" class="quiz-button green-button">
      <img src="assets/icons/check.svg" alt="Ja" />
    </button>
    <button id="no-btn" class="quiz-button red-button">
      <img src="assets/icons/xmark.svg" alt="Nein" />
    </button>
  `;

  // Buttons neu binden
  bindButtonEvents();

  restartBtn.style.display = 'none';
  showQuestion(currentQuestion);

  timer = setInterval(() => {
    currentQuestion++;
    if (currentQuestion >= questions.length) {
      clearInterval(timer);
      showGameOver();
    } else {
      showQuestion(currentQuestion);
    }
  }, 8000);
}

// Aktualisiert das Leaderboard
function updateLeaderboard() {
  leaderboardElem.innerHTML = '<h3>LEADERBOARD</h3>';

  Object.keys(scores).forEach(id => {
    if (parseInt(id) >= clientCount) delete scores[id];
  });

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  sorted.forEach(([id, score]) => {
    const entry = document.createElement('div');
    entry.textContent = `Spieler ${parseInt(id) + 1}: ${score}`;
    leaderboardElem.appendChild(entry);
  });

  if (indexElem && clientId !== null) {
    indexElem.textContent = `#${parseInt(clientId) + 1}/${clientCount}`;
  }
}

// Fügt den Buttons die Event Listener hinzu
function bindButtonEvents() {
  yesBtn = document.getElementById('yes-btn');
  noBtn = document.getElementById('no-btn');

  if (yesBtn && noBtn) {
    yesBtn.addEventListener('click', () => handleAnswer(true));
    noBtn.addEventListener('click', () => handleAnswer(false));
  }
}

// Restart-Button nur für Spieler 1
restartBtn.addEventListener('click', () => {
  if (clientId === 0) {
    sendMessage('*broadcast-message*', ['*restart*']);
    resetGame();
  }
});

// WebSocket Setup
socket.addEventListener('open', () => {
  sendMessage('*enter-room*', roomName);
  sendMessage('*subscribe-client-count*');

  setInterval(() => socket.send(''), 30000); // Keep-alive

  setInterval(() => {
    sendMessage('*broadcast-message*', ['*score-update*', [clientId, localScore]]);
  }, 10000);
});

socket.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);
  const selector = data[0];

  switch (selector) {
    case '*client-id*':
      clientId = data[1];
      scores[clientId] = 0;
      sendMessage('*broadcast-message*', ['*score-update*', [clientId, 0]]);
      updateLeaderboard();
      startQuiz();
      break;

    case '*client-count*':
      clientCount = data[1];
      sendMessage('*broadcast-message*', ['*score-update*', [clientId, localScore]]);
      updateLeaderboard();
      break;

    case '*score-update*': {
      const [id, score] = data[1];
      scores[id] = score;
      updateLeaderboard();
      break;
    }

    case '*restart*':
      resetGame();
      break;
  }
});

// Initialisiere Button-Events beim ersten Laden
bindButtonEvents();
