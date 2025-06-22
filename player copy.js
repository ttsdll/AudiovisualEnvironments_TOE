const socket = new WebSocket('wss://nosch.uber.space/carquiz/');
    const questionElem = document.getElementById('question-container');
    const infoElem = document.getElementById('info-container');
    const imageElem = document.getElementById('part-image');
    const labelElem = document.getElementById('part-label');
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
      answered = true;

      const correct = questions[currentQuestion].correct;
      const playerIsRight = (isYes === correct);

      if (playerIsRight) localScore += 100;
      else localScore -= 50;
      scoreDisplay.textContent = localScore;

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
      questionElem.innerHTML = '<h2>Spiel beendet!</h2>';
      infoElem.innerHTML = '<p>Dein Punktestand: ' + localScore + '</p>';
      updateLeaderboard();
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
        scores[clientId] = 0;        // <- NEU
        updateLeaderboard();         // <- NEU
        startQuiz();
  break;

        case '*score-update*': {
          const [id, score] = data[1];
          scores[id] = score;
          updateLeaderboard();
          break;
        }
      }
    });