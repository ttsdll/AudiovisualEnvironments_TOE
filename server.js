const WebSocket = require('ws');
const server = new WebSocket.Server({ port: 3000 });

const rooms = new Map();
const clients = new Map();

const questions = [
  { image: 'assets/images/teil1.jpg', label: 'Zündkerze', correct: true },
  { image: 'assets/images/teil2.jpg', label: 'Lichtmaschine', correct: false },
  { image: 'assets/images/teil3.jpg', label: 'Keilriemen', correct: true },
  { image: 'assets/images/teil4.jpg', label: 'Turbolader', correct: false }
];

class Room {
  constructor(name) {
    this.name = name;
    this.clients = new Set();
    this.scores = {};
    this.currentQuestionIndex = 0;
    this.started = false;
    this.answered = new Set();
  }

  addClient(client) {
    this.clients.add(client);
    client.room = this;

    const id = `Spieler-${Math.floor(Math.random() * 10000)}`;
    client.id = id;
    this.scores[id] = 0;

    return id;
  }

  removeClient(client) {
    this.clients.delete(client);
    delete this.scores[client.id];
  }

  getClientCount() {
    return this.clients.size;
  }

  sendToAll(selector, data) {
    this.clients.forEach(c => c.sendMessage(selector, data));
  }

  startQuiz() {
    if (this.started) return;
    this.started = true;
    this.sendNextQuestion();

    this.timer = setInterval(() => {
      this.currentQuestionIndex++;
      this.answered.clear();

      if (this.currentQuestionIndex >= questions.length) {
        clearInterval(this.timer);
        this.sendToAll('*game-over*', this.scores);
      } else {
        this.sendNextQuestion();
      }
    }, 8000);
  }

  sendNextQuestion() {
    const q = questions[this.currentQuestionIndex];
    this.sendToAll('question', q);
  }

  handleAnswer(clientId, isCorrect) {
    if (this.answered.has(clientId)) return; // Nur eine Antwort pro Frage
    this.answered.add(clientId);

    if (this.scores[clientId] !== undefined) {
      this.scores[clientId] += isCorrect ? 100 : -50;
    }
    this.sendToAll('*leaderboard*', this.scores);
  }
}

class Client {
  constructor(socket) {
    this.socket = socket;
    this.room = null;
    this.id = null;

    this.socket.on('message', (data) => {
      if (data.length === 0) return;

      const [selector, payload] = JSON.parse(data);

      switch (selector) {
        case '*enter-room*': {
          const name = payload;
          let room = rooms.get(name);
          if (!room) {
            room = new Room(name);
            rooms.set(name, room);
          }

          const clientId = room.addClient(this);
          this.id = clientId;
          this.sendMessage('*client-id*', clientId);
          room.sendToAll('*client-count*', room.getClientCount());
          room.startQuiz();
          break;
        }

        case '*exit-room*': {
          const room = this.room;
          if (room) {
            room.removeClient(this);
            room.sendToAll('*client-count*', room.getClientCount());
          }
          break;
        }

        case '*answer*': {
          const [clientId, isCorrect] = payload;
          if (this.room) {
            this.room.handleAnswer(clientId, isCorrect);
          }
          break;
        }
      }
    });

    this.socket.on('close', () => {
      const room = this.room;
      if (room) {
        room.removeClient(this);
        room.sendToAll('*client-count*', room.getClientCount());
      }
    });
  }

  sendMessage(selector, data) {
    const message = JSON.stringify([selector, data]);
    this.socket.send(message);
  }
}

server.on('connection', (socket) => {
  const client = new Client(socket);
  clients.set(socket, client);
});
