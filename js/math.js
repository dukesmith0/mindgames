// Speed Math — zetamac-style 60-second game

/**
 * Returns a random integer in [min, max] (inclusive).
 */
function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generates a single math problem.
 * Pure function — no DOM dependency.
 * @returns {{ text: string, answer: number }}
 */
export function generateProblem() {
  const op = rand(0, 3);

  if (op === 0) {
    // Addition: a + b
    const a = rand(2, 100);
    const b = rand(2, 100);
    return { text: `${a} + ${b}`, answer: a + b };
  }

  if (op === 1) {
    // Subtraction: (a+b) - a = b (always positive)
    const a = rand(2, 100);
    const b = rand(2, 100);
    const sum = a + b;
    return { text: `${sum} - ${a}`, answer: b };
  }

  if (op === 2) {
    // Multiplication: a × b
    const a = rand(2, 12);
    const b = rand(2, 100);
    return { text: `${a} × ${b}`, answer: a * b };
  }

  // Division: (a*b) ÷ a = b (always integer)
  const a = rand(2, 12);
  const b = rand(2, 100);
  const product = a * b;
  return { text: `${product} ÷ ${a}`, answer: b };
}

// --- DOM controller ---

let timerInterval = null;

/**
 * Stops any running math game.
 */
export function cleanupMathGame() {
  if (timerInterval !== null) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

/**
 * Initialises and runs the speed math game.
 * @param {(score: number) => void} onComplete — called with final score when timer expires
 */
export function initMathGame(onComplete) {
  // Clean up any previous interval
  if (timerInterval !== null) {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  const timerEl = document.getElementById('math-timer');
  const scoreEl = document.getElementById('math-score');
  const problemEl = document.getElementById('math-problem');
  const answerEl = document.getElementById('math-answer');

  let score = 0;
  let timeLeft = 600; // tenths of a second (60.0s)

  // Reset UI
  timerEl.textContent = '60.0';
  scoreEl.textContent = 'Score: 0';
  answerEl.value = '';

  // Generate first problem
  let current = generateProblem();
  problemEl.textContent = current.text;

  // Clone input to clear old listeners before wiring up this round
  const freshInput = answerEl.cloneNode(true);
  answerEl.parentNode.replaceChild(freshInput, answerEl);
  freshInput.disabled = false;
  freshInput.focus();

  // Timer countdown (100ms ticks)
  timerInterval = setInterval(() => {
    timeLeft--;
    const secs = Math.floor(timeLeft / 10);
    const tenths = timeLeft % 10;
    timerEl.textContent = `${secs}.${tenths}`;

    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      freshInput.disabled = true;
      onComplete(score);
    }
  }, 100);

  freshInput.addEventListener('input', () => {
    const val = parseInt(freshInput.value, 10);
    if (val === current.answer) {
      score++;
      scoreEl.textContent = `Score: ${score}`;
      current = generateProblem();
      problemEl.textContent = current.text;
      freshInput.value = '';
    }
  });
}
