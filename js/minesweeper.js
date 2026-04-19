// Minesweeper — 10x10 grid, 15 mines, timed

const N = 10;
const MINE_COUNT = 15;

/**
 * Places mines on an N×N grid, excluding a safe zone around (excludeR, excludeC).
 * The safe zone is the clicked cell and its 8 neighbors, so the first click is always safe
 * and typically opens up a zero-cell region.
 *
 * @param {number} rows
 * @param {number} cols
 * @param {number} mineCount
 * @param {number} excludeR
 * @param {number} excludeC
 * @returns {boolean[][]}
 */
export function generateMines(rows, cols, mineCount, excludeR, excludeC) {
  const mines = Array.from({ length: rows }, () => Array(cols).fill(false));
  const positions = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (Math.abs(r - excludeR) <= 1 && Math.abs(c - excludeC) <= 1) continue;
      positions.push([r, c]);
    }
  }
  // Fisher-Yates partial shuffle
  const pickCount = Math.min(mineCount, positions.length);
  for (let i = 0; i < pickCount; i++) {
    const j = i + Math.floor(Math.random() * (positions.length - i));
    [positions[i], positions[j]] = [positions[j], positions[i]];
    const [r, c] = positions[i];
    mines[r][c] = true;
  }
  return mines;
}

/**
 * Counts adjacent mines for each cell (non-mine cells get count 0-8; mine cells get -1).
 */
export function computeCounts(mines) {
  const rows = mines.length;
  const cols = mines[0].length;
  const counts = Array.from({ length: rows }, () => Array(cols).fill(0));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (mines[r][c]) { counts[r][c] = -1; continue; }
      let n = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const rr = r + dr;
          const cc = c + dc;
          if (rr < 0 || rr >= rows || cc < 0 || cc >= cols) continue;
          if (mines[rr][cc]) n++;
        }
      }
      counts[r][c] = n;
    }
  }
  return counts;
}

/**
 * Flood-fill reveals starting at (r, c). Mutates `revealed`. Returns set of newly-revealed coords.
 * If clicked cell has count > 0, reveals only that cell.
 * If clicked cell has count 0, recursively reveals all connected zero-count cells + their numbered borders.
 */
export function revealFlood(counts, revealed, r, c) {
  const rows = counts.length;
  const cols = counts[0].length;
  const stack = [[r, c]];
  const opened = [];
  while (stack.length > 0) {
    const [cr, cc] = stack.pop();
    if (cr < 0 || cr >= rows || cc < 0 || cc >= cols) continue;
    if (revealed[cr][cc]) continue;
    if (counts[cr][cc] === -1) continue; // never reveal mines via flood
    revealed[cr][cc] = true;
    opened.push([cr, cc]);
    if (counts[cr][cc] === 0) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          stack.push([cr + dr, cc + dc]);
        }
      }
    }
  }
  return opened;
}

/**
 * Checks win condition: all non-mine cells are revealed.
 */
export function isWon(mines, revealed) {
  const rows = mines.length;
  const cols = mines[0].length;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!mines[r][c] && !revealed[r][c]) return false;
    }
  }
  return true;
}

// --- DOM controller ---

let cleanupFn = null;

export function cleanupMinesweeperGame() {
  if (cleanupFn) { cleanupFn(); cleanupFn = null; }
}

export function initMinesweeperGame(onComplete) {
  if (cleanupFn) { cleanupFn(); cleanupFn = null; }

  const timerEl = document.getElementById('minesweeper-timer');
  const flagsEl = document.getElementById('minesweeper-flags');
  const statusEl = document.getElementById('minesweeper-status');
  const gridEl = document.getElementById('minesweeper-grid');

  let mines = null;
  let counts = null;
  const revealed = Array.from({ length: N }, () => Array(N).fill(false));
  const flagged = Array.from({ length: N }, () => Array(N).fill(false));
  let started = false;
  let gameOver = false;
  let startTime = 0;
  let rafId = null;
  let flagCount = 0;

  timerEl.textContent = '00:00.00';
  flagsEl.textContent = `Mines: ${MINE_COUNT}  Flags: 0`;
  statusEl.textContent = '';

  while (gridEl.firstChild) gridEl.removeChild(gridEl.firstChild);

  const cells = Array.from({ length: N }, () => Array(N).fill(null));

  for (let r = 0; r < N; r++) {
    const tr = document.createElement('tr');
    for (let c = 0; c < N; c++) {
      const td = document.createElement('td');
      td.className = 'ms-cell ms-hidden';
      td.dataset.row = r;
      td.dataset.col = c;
      td.addEventListener('click', () => handleReveal(r, c));
      td.addEventListener('contextmenu', (e) => { e.preventDefault(); handleFlag(r, c); });
      tr.appendChild(td);
      cells[r][c] = td;
    }
    gridEl.appendChild(tr);
  }

  function startTimer() {
    if (started) return;
    started = true;
    startTime = performance.now();
    tick();
  }

  function tick() {
    if (gameOver) return;
    const elapsed = performance.now() - startTime;
    timerEl.textContent = formatTime(elapsed);
    rafId = requestAnimationFrame(tick);
  }

  function formatTime(ms) {
    const total = Math.floor(ms / 1000);
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    const cs = Math.floor((ms % 1000) / 10);
    return String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0') + '.' + String(cs).padStart(2, '0');
  }

  function updateFlagsDisplay() {
    flagsEl.textContent = `Mines: ${MINE_COUNT}  Flags: ${flagCount}`;
  }

  function paintCell(r, c) {
    const td = cells[r][c];
    td.classList.remove('ms-hidden', 'ms-revealed', 'ms-flagged', 'ms-mine', 'ms-exploded');
    td.textContent = '';
    td.dataset.n = '';
    if (!revealed[r][c]) {
      if (flagged[r][c]) {
        td.classList.add('ms-flagged');
        td.textContent = '⚑';
      } else {
        td.classList.add('ms-hidden');
      }
      return;
    }
    // revealed
    if (mines && mines[r][c]) {
      td.classList.add('ms-mine');
      td.textContent = '●';
      return;
    }
    td.classList.add('ms-revealed');
    const n = counts ? counts[r][c] : 0;
    if (n > 0) {
      td.textContent = String(n);
      td.dataset.n = String(n);
    }
  }

  function handleReveal(r, c) {
    if (gameOver) return;
    if (flagged[r][c]) return;
    if (revealed[r][c]) return;

    if (!started) {
      // First click — generate mines, excluding this cell's neighborhood
      mines = generateMines(N, N, MINE_COUNT, r, c);
      counts = computeCounts(mines);
      startTimer();
    }

    if (mines[r][c]) {
      // Boom
      revealed[r][c] = true;
      gameOver = true;
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      // Reveal all mines
      for (let rr = 0; rr < N; rr++) {
        for (let cc = 0; cc < N; cc++) {
          if (mines[rr][cc]) revealed[rr][cc] = true;
          paintCell(rr, cc);
        }
      }
      cells[r][c].classList.add('ms-exploded');
      statusEl.textContent = 'Boom! Click Retry to try again.';
      return;
    }

    const opened = revealFlood(counts, revealed, r, c);
    for (const [rr, cc] of opened) paintCell(rr, cc);

    if (isWon(mines, revealed)) {
      gameOver = true;
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      const elapsed = performance.now() - startTime;
      const elapsedSeconds = parseFloat((elapsed / 1000).toFixed(2));
      statusEl.textContent = 'Cleared!';
      onComplete(elapsedSeconds);
    }
  }

  function handleFlag(r, c) {
    if (gameOver) return;
    if (revealed[r][c]) return;
    flagged[r][c] = !flagged[r][c];
    flagCount += flagged[r][c] ? 1 : -1;
    updateFlagsDisplay();
    paintCell(r, c);
  }

  cleanupFn = () => {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    gameOver = true;
  };
}
