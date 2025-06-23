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

// Web Audio API
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

  const correct = questions[currentQuestion].correct;
  const playerIsRight = (isYes === correct);

  localScore += playerIsRight ? 100 : -50;
  scoreDisplay.textContent = localScore;
  scores[clientId] = localScore;
  updateLeaderboard();

  sendMessage('*score-update*', [clientId, localScore]);

  const selectedBtn = isYes ? yesBtn : noBtn;
  selectedBtn.classList.add('selected');
  yesBtn.disabled = true;
  noBtn.disabled = true;
}

function startQuiz() {
  currentQuestion = 0;
  localScore = 0;
  scoreDisplay.textContent = localScore;
  scores[clientId] = localScore;
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

function showGameOver() {
  questionElem.innerHTML = '<h2>Spiel beendet!</h2>';
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
    <button id="yes-btn" class="quiz-button">✅</button>
    <button id="no-btn" class="quiz-button">❌</button>
  `;
  yesBtn = document.getElementById('yes-btn');
  noBtn = document.getElementById('no-btn');
  yesBtn.addEventListener('click', () => handleAnswer(true));
  noBtn.addEventListener('click', () => handleAnswer(false));

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

function updateLeaderboard() {
  leaderboardElem.innerHTML = '<h3>Leaderboard</h3>';

  // Ergänzung: Stelle sicher, dass jeder Slot von 0 bis clientCount - 1 existiert
  for (let i = 0; i < clientCount; i++) {
    if (!(i in scores)) {
      scores[i] = 0;
    }
  }

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  sorted.forEach(([id, score]) => {
    const entry = document.createElement('div');
    entry.textContent = `Spieler ${parseInt(id) + 1}: ${score}`;
    leaderboardElem.appendChild(entry);
  });

  if (indexElem) {
    indexElem.textContent = `#${parseInt(clientId) + 1}/${clientCount}`;
  }
}

yesBtn.addEventListener('click', () => handleAnswer(true));
noBtn.addEventListener('click', () => handleAnswer(false));

restartBtn.addEventListener('click', () => {
  console.log("🔁 Restart-Button gedrückt von Spieler ID:", clientId);
  if (clientId === 0 || clientId === '0') {
    sendMessage('*restart*');
    resetGame();
    console.log("Neustart ausgeführt");
  } else {
    console.log("Kein Neustart erlaubt – nur Spieler 1 darf");
  }
});

socket.addEventListener('open', () => {
  sendMessage('*enter-room*', roomName);
  sendMessage('*subscribe-client-count*');
  setInterval(() => socket.send(''), 30000); // Keep-alive
  console.log("WebSocket verbunden mit Raum:", roomName);
});

socket.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);
  const selector = data[0];

  switch (selector) {
    case '*client-id*':
      clientId = data[1];
      scores[clientId] = 0;

      // Direkt Score senden, damit andere dich kennen
      sendMessage('*score-update*', [clientId, 0]);

      updateLeaderboard();
      startQuiz();
      break;

    case '*client-count*':
      clientCount = data[1];
      updateLeaderboard();
      break;

    case '*score-update*': {
      const [id, score] = data[1];
      scores[id] = score;
      updateLeaderboard();
      break;
    }

    case '*restart*':
      console.log("⏩ Neustartsignal empfangen!");
      resetGame();
      break;
  }
});
