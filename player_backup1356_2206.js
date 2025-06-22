const socket = new WebSocket('wss://nosch.uber.space/web-rooms/');
let questionElem = document.getElementById('question-container');
let infoElem = document.getElementById('info-container');
let imageElem = document.getElementById('part-image');
let labelElem = document.getElementById('part-label');
const yesBtn = document.getElementById('yes-btn');
const noBtn = document.getElementById('no-btn');
const leaderboardElem = document.getElementById('leaderboard');
const scoreDisplay = document.getElementById('score-display');

let clientId = null;
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

  if (playerIsRight) localScore += 100;
  else localScore -= 50;

  scoreDisplay.textContent = localScore;
  scores[clientId] = localScore; // lokal aktualisieren
  updateLeaderboard();

  sendMessage('*score-update*', [clientId, localScore]);

  const selectedBtn = isYes ? yesBtn : noBtn;
  selectedBtn.classList.add('selected');
  yesBtn.disabled = true;
  noBtn.disabled = true;
  console.log("Buttons wurden deaktiviert");
}

function startQuiz() {
  currentQuestion = 0;
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
  // Zeige "Spiel beendet"-Text
  questionElem.innerHTML = '<h2>Spiel beendet!</h2>';

  // Info aktualisieren
  infoElem.innerHTML = `<p>Dein Punktestand: ${localScore}</p>`;

  // Entferne Ja/Nein-Buttons aus .button-box
  const buttonBox = document.querySelector('.button-box');
  buttonBox.innerHTML = ''; // Leert alles

  // Füge Restart-Button an gleicher Stelle hinzu
  const restartBtn = document.createElement('button');
  restartBtn.id = 'restart-btn';
  restartBtn.classList.add('restart-button');
  restartBtn.textContent = '🔄 Neustarten';

  // Wenn Spieler 0 → Button klickbar, sonst deaktiviert
  if (clientId === '0') {
    restartBtn.addEventListener('click', () => {
    console.log("Restart-Button gedrückt");
    sendMessage('*restart*');
    }
    )
  } else {
    restartBtn.disabled = true;
    restartBtn.textContent = '⏳ Warte auf Neustart …';
  }

  buttonBox.appendChild(restartBtn);

  updateLeaderboard();
}


function resetGame() {
  currentQuestion = 0;
  localScore = 0;
  scores[clientId] = 0;
  scoreDisplay.textContent = localScore;
  updateLeaderboard();

  // Fragebox neu setzen
  questionElem.innerHTML = `
    <img id="part-image" src="" alt="Autoteil" />
    <p id="part-label">Warte auf Start …</p>
  `;
  // Reinitialisieren nach innerHTML
  imageElem = document.getElementById('part-image');
  labelElem = document.getElementById('part-label');

  yesBtn.disabled = false;
  noBtn.disabled = false;

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
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  sorted.forEach(([id, score]) => {
    const entry = document.createElement('div');
    entry.textContent = `Spieler ${id}: ${score}`;
    leaderboardElem.appendChild(entry);
  });
}

yesBtn.addEventListener('click', () => handleAnswer(true));
noBtn.addEventListener('click', () => handleAnswer(false));

socket.addEventListener('open', () => {
  sendMessage('*enter-room*', roomName);
});

socket.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);
  const selector = data[0];

  switch (selector) {
    case '*client-id*':
      clientId = data[1];
      console.log("Client ID erhalten:", clientId);
      scores[clientId] = 0;
      updateLeaderboard();
      startQuiz();
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
