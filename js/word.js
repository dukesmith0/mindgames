// Word Recall — show 10 words for 20s, recall as many as possible

/**
 * Built-in list of common, simple, distinct English words (4-7 letters).
 */
export const WORDLIST = [
  'apple', 'table', 'river', 'cloud', 'brick',
  'paper', 'stone', 'chair', 'plant', 'music',
  'bread', 'dance', 'light', 'smile', 'ocean',
  'flame', 'grass', 'window', 'forest', 'bridge',
  'candle', 'marble', 'pencil', 'coffee', 'jacket',
  'planet', 'rocket', 'garden', 'puzzle', 'ladder',
  'basket', 'anchor', 'glove', 'honey', 'lemon',
  'piano', 'sugar', 'orange', 'cactus', 'silver',
  'island', 'zebra', 'arrow', 'butter', 'copper',
  'dragon', 'helmet', 'tiger', 'eagle', 'mouse',
  'castle', 'wizard', 'kitten', 'desert', 'valley',
  'pillow', 'button', 'turtle', 'violet', 'meadow',
  'jungle', 'rabbit', 'wagon', 'banjo', 'canyon',
  'diamond', 'engine', 'falcon', 'galaxy', 'harbor',
  'iceberg', 'jigsaw', 'kimono', 'lizard', 'magnet',
  'needle', 'orchid', 'parrot', 'quartz', 'riddle',
  'saddle', 'toffee', 'umbrella', 'violin', 'walnut',
  'yogurt', 'bubble', 'cookie', 'dimple', 'ember',
  'fossil', 'gravel', 'hammer', 'igloo', 'kayak',
  'lantern', 'monkey', 'napkin', 'oxygen', 'pebble',
  'quilt', 'ribbon', 'sandal', 'teapot', 'unicorn',
  'vortex', 'whisker', 'yellow', 'zipper', 'acorn',
  'badger', 'clover', 'donkey', 'envelope', 'feather'
];

/**
 * Returns a random integer in [min, max] (inclusive).
 */
function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Returns `count` distinct random words from `pool` (defaults to WORDLIST).
 * Pure function — no DOM dependency.
 * @param {number} count
 * @param {string[]} [pool]
 * @returns {string[]}
 */
export function selectWords(count = 10, pool = WORDLIST) {
  // Fisher-Yates partial shuffle on a copy
  const arr = pool.slice();
  const n = Math.min(count, arr.length);
  for (let i = 0; i < n; i++) {
    const j = rand(i, arr.length - 1);
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr.slice(0, n);
}

/**
 * Score a user's recall attempt against the shown words.
 * Case-insensitive. Deduplicates user input. No penalty for wrong words.
 * Pure function — no DOM dependency.
 * @param {string[]} shownWords
 * @param {string} userInput
 * @returns {number}
 */
export function scoreRecall(shownWords, userInput) {
  if (typeof userInput !== 'string' || userInput.length === 0) return 0;

  const shownSet = new Set(shownWords.map((w) => w.toLowerCase()));

  // Split on any non-letter character (whitespace, commas, newlines, etc.)
  const tokens = userInput
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((t) => t.length > 0);

  const userSet = new Set(tokens);

  let count = 0;
  for (const w of userSet) {
    if (shownSet.has(w)) count++;
  }
  return count;
}

// --- DOM controller ---

let countdownInterval = null;
let submitHandler = null;
let keyHandler = null;
let submitButton = null;
let inputEl = null;

function cleanup() {
  if (countdownInterval !== null) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
  if (submitButton !== null && submitHandler !== null) {
    submitButton.removeEventListener('click', submitHandler);
  }
  if (inputEl !== null && keyHandler !== null) {
    inputEl.removeEventListener('keydown', keyHandler);
  }
  submitHandler = null;
  keyHandler = null;
  submitButton = null;
  inputEl = null;
}

/**
 * Stops any running word recall game and clears all listeners/intervals.
 */
export function cleanupWordGame() {
  cleanup();
}

/**
 * Initialises and runs the word recall game.
 * @param {(score: number) => void} onComplete — called with final score (0-10) after user submits
 */
export function initWordGame(onComplete) {
  cleanup();

  const showPhase = document.getElementById('word-phase-show');
  const recallPhase = document.getElementById('word-phase-recall');
  const listEl = document.getElementById('word-list');
  const countdownEl = document.getElementById('word-countdown');
  inputEl = document.getElementById('word-input');
  submitButton = document.getElementById('word-submit');

  const shown = selectWords(10);

  // Render words into the grid
  while (listEl.firstChild) listEl.removeChild(listEl.firstChild);
  for (const w of shown) {
    const cell = document.createElement('div');
    cell.className = 'word-item';
    cell.textContent = w;
    listEl.appendChild(cell);
  }

  // Reset UI: show phase visible, recall phase hidden
  showPhase.hidden = false;
  recallPhase.hidden = true;
  inputEl.value = '';

  let timeLeft = 200; // tenths of a second (20.0s)
  countdownEl.textContent = '20s remaining';

  countdownInterval = setInterval(() => {
    timeLeft--;
    const secs = Math.ceil(timeLeft / 10);
    countdownEl.textContent = `${secs}s remaining`;

    if (timeLeft <= 0) {
      clearInterval(countdownInterval);
      countdownInterval = null;
      // Transition to recall phase
      showPhase.hidden = true;
      recallPhase.hidden = false;
      inputEl.focus();
    }
  }, 100);

  function finish() {
    if (countdownInterval !== null) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
    const score = scoreRecall(shown, inputEl.value);
    cleanup();
    onComplete(score);
  }

  submitHandler = () => {
    finish();
  };
  submitButton.addEventListener('click', submitHandler);

  keyHandler = (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      finish();
    }
  };
  inputEl.addEventListener('keydown', keyHandler);
}
