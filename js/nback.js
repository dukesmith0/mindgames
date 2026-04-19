// N-Back — 2-back working memory game

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const TOTAL_TRIALS = 22;
const LETTER_MS = 1000;
const BLANK_MS = 1500;
const TRIAL_MS = LETTER_MS + BLANK_MS; // 2500ms per trial — response allowed throughout

/**
 * Returns a random letter from the pool.
 * @returns {string}
 */
function randomLetter() {
  return LETTERS[Math.floor(Math.random() * LETTERS.length)];
}

/**
 * Returns a random letter that is NOT equal to `exclude`.
 * @param {string} exclude
 * @returns {string}
 */
function randomLetterExcluding(exclude) {
  const pool = LETTERS.filter((l) => l !== exclude);
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Generates a 2-back letter stream.
 * Pure function — no DOM dependency.
 * @param {number} length — total number of trials
 * @param {number} targetProb — probability that a scorable trial is a target
 * @returns {{ stream: string[], isTarget: boolean[] }}
 */
export function generateStream(length = TOTAL_TRIALS, targetProb = 0.3) {
  const stream = new Array(length);
  const isTarget = new Array(length).fill(false);

  // First two letters: random, never targets.
  for (let i = 0; i < Math.min(2, length); i++) {
    stream[i] = randomLetter();
  }

  for (let i = 2; i < length; i++) {
    if (Math.random() < targetProb) {
      // Target: match letter from 2 back
      stream[i] = stream[i - 2];
    } else {
      // Non-target: pick a letter that is NOT equal to stream[i-2]
      stream[i] = randomLetterExcluding(stream[i - 2]);
    }
    isTarget[i] = stream[i] === stream[i - 2];
  }

  return { stream, isTarget };
}

/**
 * Scores user responses against target pattern.
 * Only trials at index >= 2 are scorable (20 trials in a 22-length stream).
 * Pure function — no DOM dependency.
 * @param {boolean[]} isTarget
 * @param {boolean[]} responses — responses[i] true iff user pressed on trial i
 * @returns {{ hits: number, correctRejections: number, falseAlarms: number, misses: number, accuracy: number }}
 */
export function scoreTrials(isTarget, responses) {
  let hits = 0;
  let correctRejections = 0;
  let falseAlarms = 0;
  let misses = 0;

  const len = isTarget.length;
  let scorable = 0;
  for (let i = 2; i < len; i++) {
    scorable++;
    const target = !!isTarget[i];
    const pressed = !!responses[i];
    if (target && pressed) hits++;
    else if (target && !pressed) misses++;
    else if (!target && pressed) falseAlarms++;
    else correctRejections++;
  }

  const accuracy = scorable === 0
    ? 0
    : Math.round(((hits + correctRejections) / scorable) * 100);

  return { hits, correctRejections, falseAlarms, misses, accuracy };
}

// --- DOM controller ---

let trialTimeouts = [];
let countdownTimeouts = [];
let keyHandler = null;
let clickHandler = null;
let clickArea = null;

function clearAllTimeouts() {
  for (const t of trialTimeouts) clearTimeout(t);
  trialTimeouts = [];
  for (const t of countdownTimeouts) clearTimeout(t);
  countdownTimeouts = [];
}

function cleanup() {
  clearAllTimeouts();
  if (keyHandler !== null) {
    document.removeEventListener('keydown', keyHandler);
    keyHandler = null;
  }
  if (clickHandler !== null && clickArea !== null) {
    clickArea.removeEventListener('click', clickHandler);
  }
  clickHandler = null;
  clickArea = null;
}

/**
 * Stops any running N-Back game.
 */
export function cleanupNBackGame() {
  cleanup();
}

/**
 * Initialises and runs the 2-back N-Back game.
 * @param {(score: number) => void} onComplete — called with accuracy 0-100
 */
export function initNBackGame(onComplete) {
  cleanup();

  const displayEl = document.getElementById('nback-display');
  const messageEl = document.getElementById('nback-message');
  const progressEl = document.getElementById('nback-progress');
  const areaEl = document.getElementById('nback-area');

  const { stream, isTarget } = generateStream(TOTAL_TRIALS, 0.3);
  const responses = new Array(TOTAL_TRIALS).fill(false);

  let currentTrial = -1; // -1 = not yet started
  let canRespond = false;
  let finished = false;

  function renderProgress() {
    let out = '';
    for (let i = 0; i < TOTAL_TRIALS; i++) {
      if (i < currentTrial) out += '●';
      else if (i === currentTrial) out += '◉';
      else out += '○';
    }
    progressEl.textContent = out;
  }

  function recordResponse() {
    if (!canRespond || finished) return;
    if (currentTrial < 0 || currentTrial >= TOTAL_TRIALS) return;
    responses[currentTrial] = true;
  }

  function handleInput() {
    recordResponse();
  }

  keyHandler = (e) => {
    if (e.key !== ' ') return;
    e.preventDefault();
    handleInput();
  };
  document.addEventListener('keydown', keyHandler);

  clickHandler = (e) => {
    e.preventDefault();
    handleInput();
  };
  clickArea = areaEl;
  if (areaEl) areaEl.addEventListener('click', clickHandler);

  function finish() {
    if (finished) return;
    finished = true;
    canRespond = false;
    clearAllTimeouts();
    displayEl.textContent = '';
    messageEl.textContent = 'Done!';
    const result = scoreTrials(isTarget, responses);
    onComplete(result.accuracy);
  }

  function runTrial(index) {
    if (finished) return;
    currentTrial = index;
    canRespond = true; // response window open for the whole trial

    // Show letter
    displayEl.textContent = stream[index];
    messageEl.textContent = `Trial ${index + 1} / ${TOTAL_TRIALS}`;
    renderProgress();

    // After LETTER_MS, blank the letter (response window stays open)
    const hideT = setTimeout(() => {
      if (finished) return;
      displayEl.textContent = '';
    }, LETTER_MS);
    trialTimeouts.push(hideT);

    // After full TRIAL_MS, close window and advance
    const nextT = setTimeout(() => {
      if (finished) return;
      canRespond = false;
      if (index + 1 >= TOTAL_TRIALS) {
        finish();
      } else {
        runTrial(index + 1);
      }
    }, TRIAL_MS);
    trialTimeouts.push(nextT);
  }

  function startStream() {
    if (finished) return;
    runTrial(0);
  }

  // Reset UI + run countdown
  displayEl.textContent = '';
  progressEl.textContent = '';
  messageEl.textContent = 'Get ready...';

  const c1 = setTimeout(() => { if (!finished) displayEl.textContent = '3'; }, 0);
  const c2 = setTimeout(() => { if (!finished) displayEl.textContent = '2'; }, 1000);
  const c3 = setTimeout(() => { if (!finished) displayEl.textContent = '1'; }, 2000);
  const c4 = setTimeout(() => {
    if (finished) return;
    displayEl.textContent = 'Go';
  }, 2800);
  const c5 = setTimeout(() => {
    if (finished) return;
    displayEl.textContent = '';
    startStream();
  }, 3000);
  countdownTimeouts.push(c1, c2, c3, c4, c5);
}
