// Digit Span — short-term memory game
// No overall time cap — game ends only on a wrong answer or reaching MAX_LENGTH.

const MAX_LENGTH = 15;
const START_LENGTH = 3;

/**
 * Generates a random digit sequence.
 * Pure function — no DOM dependency.
 * @param {number} length — number of digits in the sequence
 * @returns {string} sequence of N random digits (0-9)
 */
export function generateSequence(length) {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += Math.floor(Math.random() * 10).toString();
  }
  return out;
}

/**
 * Compares two sequences for equality after trimming whitespace.
 * Pure function — no DOM dependency.
 * @param {string} expected
 * @param {string} actual
 * @returns {boolean}
 */
export function isMatch(expected, actual) {
  return String(expected).trim() === String(actual).trim();
}

/**
 * Returns the display duration (ms) for a sequence of the given length.
 * 2000ms for length 3, +500ms per extra digit.
 * Pure function — no DOM dependency.
 * @param {number} length
 * @returns {number}
 */
export function getDisplayTime(length) {
  return 2000 + (length - 3) * 500;
}

// --- DOM controller ---

let displayTimeout = null;
let keyHandler = null;
let currentInput = null;

function cleanup() {
  if (displayTimeout !== null) {
    clearTimeout(displayTimeout);
    displayTimeout = null;
  }
  if (keyHandler !== null && currentInput !== null) {
    currentInput.removeEventListener('keydown', keyHandler);
  }
  keyHandler = null;
  currentInput = null;
}

/**
 * Stops any running digit span game.
 */
export function cleanupDigitGame() {
  cleanup();
}

/**
 * Initialises and runs the digit span game.
 * @param {(score: number) => void} onComplete — called with final score (longest completed length)
 */
export function initDigitGame(onComplete) {
  cleanup();

  const displayEl = document.getElementById('digit-display');
  const inputEl = document.getElementById('digit-input');
  const messageEl = document.getElementById('digit-message');
  const roundEl = document.getElementById('digit-round');

  let round = 1;
  let length = START_LENGTH;
  let score = 0;
  let currentSequence = '';
  let finished = false;

  function finish() {
    if (finished) return;
    finished = true;
    cleanup();
    inputEl.style.display = 'none';
    displayEl.textContent = '';
    messageEl.textContent = `Game over — longest sequence: ${score}`;
    onComplete(score);
  }

  function showSequence() {
    if (finished) return;

    currentSequence = generateSequence(length);
    roundEl.textContent = `Round ${round}, Length ${length}`;
    messageEl.textContent = 'Memorise...';
    inputEl.style.display = 'none';
    inputEl.value = '';
    displayEl.textContent = currentSequence;

    const showTime = getDisplayTime(length);
    displayTimeout = setTimeout(() => {
      displayTimeout = null;
      promptAnswer();
    }, showTime);
  }

  function promptAnswer() {
    if (finished) return;

    displayEl.textContent = '';
    messageEl.textContent = 'Type the sequence and press Enter';
    inputEl.style.display = '';
    inputEl.value = '';
    inputEl.focus();
  }

  function submitAnswer() {
    if (finished) return;

    const answer = inputEl.value;
    if (!isMatch(currentSequence, answer)) {
      finish();
      return;
    }

    // Correct — score updates to completed length
    score = length;
    round++;
    length++;

    if (length > MAX_LENGTH) {
      finish();
      return;
    }

    showSequence();
  }

  // Reset UI
  displayEl.textContent = '';
  messageEl.textContent = '';
  roundEl.textContent = '';
  inputEl.value = '';
  inputEl.style.display = 'none';
  inputEl.disabled = false;

  // Attach Enter listener to input
  currentInput = inputEl;
  keyHandler = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitAnswer();
    }
  };
  inputEl.addEventListener('keydown', keyHandler);

  // Start first round
  showSequence();
}
