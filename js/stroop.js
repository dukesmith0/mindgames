// Stroop — 30-second color-word interference game

export const COLORS = ['red', 'blue', 'green', 'yellow'];

const COLOR_HEX = {
  red: '#e53935',
  blue: '#1e88e5',
  green: '#43a047',
  yellow: '#fdd835',
};

/**
 * Generates a single Stroop trial.
 * Pure function — no DOM dependency.
 * Retries up to 10 times if the result duplicates `prev` on BOTH word and ink
 * (same word + same ink back-to-back). Same word with different ink, or same ink
 * with different word, is allowed.
 * @param {number} incongruentProb — probability [0,1] that the trial is incongruent (word !== ink)
 * @param {{word: string, ink: string} | null} [prev] — previous trial; if provided, the new trial
 *   will not match both axes simultaneously.
 * @returns {{ word: string, ink: string, congruent: boolean }}
 */
export function generateTrial(incongruentProb = 0.7, prev = null) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const ink = COLORS[Math.floor(Math.random() * COLORS.length)];
    const incongruent = Math.random() < incongruentProb;

    let wordColor;
    if (incongruent) {
      const others = COLORS.filter((c) => c !== ink);
      wordColor = others[Math.floor(Math.random() * others.length)];
    } else {
      wordColor = ink;
    }

    const trial = {
      word: wordColor.toUpperCase(),
      ink,
      congruent: wordColor === ink,
    };

    if (!prev || trial.word !== prev.word || trial.ink !== prev.ink) {
      return trial;
    }
  }
  // Fallback: force-swap ink so we're guaranteed non-duplicate.
  const fallbackInk = COLORS.find((c) => c !== prev.ink) || COLORS[0];
  return {
    word: prev.word,
    ink: fallbackInk,
    congruent: prev.word.toLowerCase() === fallbackInk,
  };
}

/**
 * Returns true iff selectedInk matches the trial's ink color.
 * Pure function — no DOM dependency.
 * @param {{ word: string, ink: string, congruent: boolean }} trial
 * @param {string} selectedInk
 * @returns {boolean}
 */
export function isCorrect(trial, selectedInk) {
  return selectedInk === trial.ink;
}

// --- DOM controller ---

let timerInterval = null;
let flashTimeout = null;
let keyHandler = null;
const buttonHandlers = new Map(); // button element -> handler

function cleanup() {
  if (timerInterval !== null) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  if (flashTimeout !== null) {
    clearTimeout(flashTimeout);
    flashTimeout = null;
  }
  if (keyHandler !== null) {
    document.removeEventListener('keydown', keyHandler);
    keyHandler = null;
  }
  for (const [btn, handler] of buttonHandlers.entries()) {
    btn.removeEventListener('click', handler);
  }
  buttonHandlers.clear();
}

/**
 * Stops any running Stroop game.
 */
export function cleanupStroopGame() {
  cleanup();
}

/**
 * Initialises and runs the Stroop game.
 * @param {(score: number) => void} onComplete — called with final score when timer expires
 */
export function initStroopGame(onComplete) {
  cleanup();

  const timerEl = document.getElementById('stroop-timer');
  const scoreEl = document.getElementById('stroop-score');
  const wordEl = document.getElementById('stroop-word');
  const buttonsEl = document.getElementById('stroop-buttons');

  let score = 0;
  let timeLeft = 300; // tenths of a second (30.0s)
  let current = generateTrial();

  function renderTrial() {
    wordEl.textContent = current.word;
    wordEl.style.color = COLOR_HEX[current.ink];
  }

  function flashWrong() {
    wordEl.style.color = COLOR_HEX.red;
    wordEl.classList.add('stroop-wrong');
    if (flashTimeout !== null) clearTimeout(flashTimeout);
    flashTimeout = setTimeout(() => {
      wordEl.classList.remove('stroop-wrong');
      // Restore the actual ink color (word unchanged, still awaiting correct answer)
      wordEl.style.color = COLOR_HEX[current.ink];
      flashTimeout = null;
    }, 150);
  }

  function respond(selectedInk) {
    if (timeLeft <= 0) return;
    if (isCorrect(current, selectedInk)) {
      // Cancel any pending wrong-flash restoration so it doesn't overwrite the new trial's color
      if (flashTimeout !== null) {
        clearTimeout(flashTimeout);
        flashTimeout = null;
        wordEl.classList.remove('stroop-wrong');
      }
      score++;
      scoreEl.textContent = `Score: ${score}`;
      current = generateTrial(0.7, current);
      renderTrial();
    } else {
      flashWrong();
    }
  }

  // Reset UI
  timerEl.textContent = '30.0';
  scoreEl.textContent = 'Score: 0';
  renderTrial();

  // Keyboard: 1/2/3/4 -> red/blue/green/yellow
  keyHandler = (e) => {
    const idx = ['1', '2', '3', '4'].indexOf(e.key);
    if (idx === -1) return;
    e.preventDefault();
    respond(COLORS[idx]);
  };
  document.addEventListener('keydown', keyHandler);

  // Click handlers on colored buttons
  if (buttonsEl) {
    const buttons = buttonsEl.querySelectorAll('[data-color]');
    buttons.forEach((btn) => {
      const color = btn.getAttribute('data-color');
      const handler = (e) => {
        e.preventDefault();
        respond(color);
      };
      btn.addEventListener('click', handler);
      buttonHandlers.set(btn, handler);
    });
  }

  // Timer countdown (100ms ticks)
  timerInterval = setInterval(() => {
    timeLeft--;
    const secs = Math.floor(timeLeft / 10);
    const tenths = timeLeft % 10;
    timerEl.textContent = `${secs}.${tenths}`;

    if (timeLeft <= 0) {
      cleanup();
      onComplete(score);
    }
  }, 100);
}
