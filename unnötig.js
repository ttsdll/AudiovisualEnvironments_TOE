const infoElem = document.getElementById('info-container');

const socket = new WebSocket('wss://nosch.uber.space/web-rooms/');

let clientId = null;
let clientCount = 0;

// Fragenpool (4 Autoteil-Fragen)
const questions = [
  {
    image: 'assets/images/teil1.jpg',
    label: 'Zündkerze',
    correct: true
  },
  {
    image: 'assets/images/teil2.jpg',
    label: 'Lichtmaschine',
    correct: false
  },
  {
    image: 'assets/images/teil3.jpg',
    label: 'Keilriemen',
    correct: true
  },
  {
    image: 'assets/images/teil4.jpg',
    label: 'Turbolader',
    correct: false
  }
];

let questionIndex = 0;

// Hilfsfunktion zum Senden
function sendRequest(type, data) {
  socket.send(JSON.stringify([type, data]));
}

// Verbindung geöffnet
socket.addEventListener('open', () => {
  sendRequest('*enter-room*', 'carquiz');
  sendRequest('*subscribe-client-count*');

  // Verbindung wach halten
  setInterval(() => socket.send(''), 30000);
});

// Verbindung geschlossen
socket.addEventListener('close', () => {
  clientId = null;
  document.body.classList.add('disconnected');
});

// Nachrichten empfangen
socket.addEventListener('message', (event) => {
  const data = event.data;

  if (data.length > 0) {
    const incoming = JSON.parse(data);
    const selector = incoming[0];

    switch (selector) {
      case '*client-id*':
        clientId = incoming[1];
        startMaster();
        break;

      case '*client-count*':
        clientCount = incoming[1];
        updateClientCountDisplay();
        break;
    }
  }
});

// Spieleranzahl anzeigen
function updateClientCountDisplay() {
  infoElem.textContent = `${clientCount} Spieler verbunden`;
}

// Starte Fragerotation
function startMaster() {
  showStatus('Starte Quiz...');

  // Alle 8 Sekunden Frage senden
  const interval = setInterval(() => {
    if (questionIndex >= questions.length) {
      showStatus('Quiz beendet!');
      clearInterval(interval);
      return;
    }

    const q = questions[questionIndex];
    sendRequest('question', q);
    showStatus(`Frage ${questionIndex + 1} gesendet`);
    questionIndex++;
  }, 8000); // 8 Sekunden pro Frage
}

// UI-Hilfsanzeige
function showStatus(text) {
  infoElem.textContent = text;
}
