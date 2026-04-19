// Reaction Time — 5-trial reaction time game

const TOTAL_TRIALS = 5;

/**
 * Returns the average of an array of numbers, rounded to the nearest integer.
 * Pure function — no DOM dependency.
 * @param {number[]} times
 * @returns {number}
 */
export function calculateAverage(times) {
  const sum = times.reduce((a, b) => a + b, 0);
  return Math.round(sum / times.length);
}

/**
 * Returns a random integer delay in [2000, 5000] ms.
 * Pure function — no DOM dependency.
 * @returns {number}
 */
export function getRandomDelay() {
  return Math.floor(Math.random() * 3001) + 2000;
}

// --- DOM controller ---

let delayTimeout = null;
let interTrialTimeout = null;
let keyHandler = null;
let clickHandler = null;

function cleanup() {
  if (delayTimeout !== null) {
    clearTimeout(delayTimeout);
    delayTimeout = null;
  }
  if (interTrialTimeout !== null) {
    clearTimeout(interTrialTimeout);
    interTrialTimeout = null;
  }
  if (keyHandler !== null) {
    document.removeEventListener('keydown', keyHandler);
    keyHandler = null;
  }
  if (clickHandler !== null) {
    const area = document.getElementById('reaction-area');
    if (area) area.removeEventListener('click', clickHandler);
    clickHandler = null;
  }
}

/**
 * Stops any running reaction game.
 */
export function cleanupReactionGame() {
  cleanup();
}

/**
 * Initialises and runs the reaction time game.
 * @param {(averageMs: number) => void} onComplete — called with average reaction time after 5 successful trials
 */
export function initReactionGame(onComplete) {
  cleanup();

  const area = document.getElementById('reaction-area');
  const trialEl = document.getElementById('reaction-trial');
  const messageEl = document.getElementById('reaction-message');
  const resultsEl = document.getElementById('reaction-results');

  const times = [];
  let trial = 0;
  let greenStart = 0;
  let state = 'idle'; // idle | waiting | go | early | result

  function setAreaClass(cls) {
    area.className = 'reaction-area ' + cls;
  }

  function renderResults() {
    resultsEl.textContent = times
      .map((t, i) => `Trial ${i + 1}: ${Math.round(t)}ms`)
      .join('  |  ');
  }

  function showIdle() {
    state = 'idle';
    setAreaClass('reaction-idle');
    trialEl.textContent = '';
    messageEl.textContent = 'Press SPACE or tap to begin';
    resultsEl.textContent = '';
  }

  function startTrial() {
    state = 'waiting';
    trial++;
    setAreaClass('reaction-waiting');
    trialEl.textContent = `Trial ${trial} / ${TOTAL_TRIALS}`;
    messageEl.textContent = 'Wait for green...';
    renderResults();

    const delay = getRandomDelay();
    delayTimeout = setTimeout(() => {
      delayTimeout = null;
      state = 'go';
      setAreaClass('reaction-go');
      messageEl.textContent = 'Press SPACE or tap!';
      greenStart = performance.now();
    }, delay);
  }

  function handleEarly() {
    if (delayTimeout !== null) {
      clearTimeout(delayTimeout);
      delayTimeout = null;
    }
    trial--; // redo this trial
    state = 'early';
    setAreaClass('reaction-early');
    messageEl.textContent = 'Too early! Press SPACE to retry.';
  }

  function handleHit() {
    const reactionTime = performance.now() - greenStart;
    times.push(reactionTime);
    state = 'result';
    setAreaClass('reaction-idle');
    messageEl.textContent = `${Math.round(reactionTime)}ms`;
    renderResults();

    if (times.length >= TOTAL_TRIALS) {
      // All trials complete — brief pause then call onComplete
      interTrialTimeout = setTimeout(() => {
        interTrialTimeout = null;
        const avg = calculateAverage(times);
        onComplete(avg);
      }, 1000);
    } else {
      // Brief pause before next trial
      interTrialTimeout = setTimeout(() => {
        interTrialTimeout = null;
        startTrial();
      }, 1000);
    }
  }

  keyHandler = (e) => {
    if (e.key !== ' ') return;
    e.preventDefault();

    if (state === 'idle') {
      startTrial();
    } else if (state === 'waiting') {
      handleEarly();
    } else if (state === 'go') {
      handleHit();
    } else if (state === 'early') {
      startTrial();
    }
    // Ignore spacebar during 'result' pause
  };

  document.addEventListener('keydown', keyHandler);

  // Touch/click support for mobile
  function handleInput() {
    if (state === 'idle') {
      startTrial();
    } else if (state === 'waiting') {
      handleEarly();
    } else if (state === 'go') {
      handleHit();
    } else if (state === 'early') {
      startTrial();
    }
  }

  clickHandler = (e) => {
    e.preventDefault();
    handleInput();
  };
  area.addEventListener('click', clickHandler);

  // Reset UI to idle state
  showIdle();
}
