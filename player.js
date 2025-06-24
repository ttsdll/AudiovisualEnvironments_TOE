const socket = new WebSocket('wss://nosch.uber.space/web-rooms/');
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
const overlay = document.getElementById('start-overlay');
const startBtn = document.getElementById('start-btn');

let clientId = null;
let clientCount = 0;
let currentQuestion = 0;
let answered = false;
let localScore = 0;
let scores = {};
let timer;

const roomName = 'carquiz';

const questions = [
  { image: 'assets/images/teil1.jpg', label: 'Zündkerze', correct: true },
  { image: 'assets/images/teil2.jpg', label: 'Lichtmaschine', correct: false },
  { image: 'assets/images/teil3.jpg', label: 'Keilriemen', correct: true },
  { image: 'assets/images/teil4.jpg', label: 'Turbolader', correct: false }
];

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playClickSound() {
  const oscillator = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  oscillator.type = 'square';
  oscillator.frequency.setValueAtTime(400, audioCtx.currentTime);
  gainNode.gain.setValueAtTime(0.05, audioCtx.currentTime);
  oscillator.connect(gainNode).connect(audioCtx.destination);
  oscillator.start();
  oscillator.stop(audioCtx.currentTime + 0.1);
}

function sendMessage(selector, data) {
  socket.send(JSON.stringify([selector, data]));
}

function showQuestion(index) {
  if (!questions[index]) return;
  const q = questions[index];
  imageElem.src = q.image;
  labelElem.textContent = q.label;
  answered = false;
  yesBtn.disabled = false;
  noBtn.disabled = false;
  yesBtn.classList.remove('selected');
  noBtn.classList.remove('selected');
}

function handleAnswer(isYes) {
  if (answered) return;
  playClickSound();
  answered = true;

  const correct = questions[currentQuestion]?.correct;
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

function startQuizMaster() {
  currentQuestion = 0;
  sendMessage('*broadcast-message*', ['*question-index*', currentQuestion]);

  timer = setInterval(() => {
    currentQuestion++;
    if (currentQuestion >= questions.length) {
      clearInterval(timer);
      sendMessage('*broadcast-message*', ['*game-over*']);
    } else {
      sendMessage('*broadcast-message*', ['*question-index*', currentQuestion]);
    }
  }, 8000);
}

function showGameOver() {
  questionElem.innerHTML = '<div class="game-over-text">GAME OVER</div>';
  infoElem.innerHTML = `<p>Dein Punktestand: ${localScore}</p>`;
  document.querySelector('.button-box').innerHTML = '';
  restartBtn.style.display = 'block';
  updateLeaderboard();
}

function resetGame() {
  currentQuestion = 0;
  localScore = 0;
  scores[clientId] = 0;
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
  yesBtn = document.getElementById('yes-btn');
  noBtn = document.getElementById('no-btn');
  yesBtn.addEventListener('click', () => handleAnswer(true));
  noBtn.addEventListener('click', () => handleAnswer(false));

  restartBtn.style.display = 'none';
  updateLeaderboard();
}

function updateLeaderboard() {
  leaderboardElem.innerHTML = '<h3>LEADERBOARD</h3>';
  const activeScores = {};
  for (let i = 0; i < clientCount; i++) {
    if (scores[i] !== undefined) {
      activeScores[i] = scores[i];
    }
  }

  const sorted = Object.entries(activeScores).sort((a, b) => b[1] - a[1]);
  sorted.forEach(([id, score]) => {
    const entry = document.createElement('div');
    entry.textContent = `Spieler ${parseInt(id) + 1}: ${score}`;
    leaderboardElem.appendChild(entry);
  });

  if (indexElem && clientId !== null) {
    indexElem.textContent = `#${parseInt(clientId) + 1}/${clientCount}`;
  }
}

// Event-Handler
restartBtn.addEventListener('click', () => {
  if (clientId === 0) {
    sendMessage('*broadcast-message*', ['*restart*']);
    resetGame();
    overlay.style.display = 'flex';
  }
});

startBtn.addEventListener('click', () => {
  if (clientId === 0) {
    sendMessage('*broadcast-message*', ['*start*']);
    startQuizMaster(); // nur bei Player 1!
  }
});

yesBtn.addEventListener('click', () => handleAnswer(true));
noBtn.addEventListener('click', () => handleAnswer(false));

// WebSocket
socket.addEventListener('open', () => {
  sendMessage('*enter-room*', roomName);
  sendMessage('*subscribe-client-count*');

  setInterval(() => socket.send(''), 30000);
  setInterval(() => {
    sendMessage('*broadcast-message*', ['*score-update*', [clientId, localScore]]);
  }, 10000);
});

socket.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);
  const selector = data[0];
  const payload = data[1];

  switch (selector) {
    case '*client-id*':
      clientId = payload;
      scores[clientId] = 0;
      overlay.style.display = 'flex';
      break;

    case '*client-count*':
      clientCount = payload;
      updateLeaderboard();
      break;

    case '*score-update*': {
      const [id, score] = payload;
      scores[id] = score;
      updateLeaderboard();
      break;
    }

    case '*question-index*':
      currentQuestion = payload;
      showQuestion(currentQuestion);
      break;

    case '*game-over*':
      showGameOver();
      break;

    case '*restart*':
      resetGame();
      overlay.style.display = 'flex';
      break;

    case '*start*':
      overlay.style.display = 'none';
      break;
  }
});
