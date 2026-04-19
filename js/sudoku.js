// Sudoku — timed 6x6 puzzle with backtracking generator
// 6x6 grid, digits 1-6, boxes are 2 rows × 3 cols

const N = 6;
const BOX_ROWS = 2;
const BOX_COLS = 3;
const DIGITS = [1, 2, 3, 4, 5, 6];

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function copyGrid(grid) {
  return grid.map(row => row.slice());
}

function isValid(grid, row, col, num) {
  for (let i = 0; i < N; i++) {
    if (grid[row][i] === num) return false;
    if (grid[i][col] === num) return false;
  }
  const br = Math.floor(row / BOX_ROWS) * BOX_ROWS;
  const bc = Math.floor(col / BOX_COLS) * BOX_COLS;
  for (let r = br; r < br + BOX_ROWS; r++) {
    for (let c = bc; c < bc + BOX_COLS; c++) {
      if (grid[r][c] === num) return false;
    }
  }
  return true;
}

/**
 * Generates a fully solved 6x6 sudoku grid.
 * Backtracking with randomized candidate order.
 * @returns {number[][]}
 */
export function generateSolvedGrid() {
  const grid = Array.from({ length: N }, () => Array(N).fill(0));

  function solve(g) {
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if (g[r][c] === 0) {
          const candidates = shuffle(DIGITS.slice());
          for (const num of candidates) {
            if (isValid(g, r, c, num)) {
              g[r][c] = num;
              if (solve(g)) return true;
              g[r][c] = 0;
            }
          }
          return false;
        }
      }
    }
    return true;
  }

  solve(grid);
  return grid;
}

/**
 * Counts solutions via backtracking, stops at limit.
 * @param {number[][]} grid
 * @param {number} [limit=2]
 * @returns {number}
 */
export function countSolutions(grid, limit = 2) {
  const g = copyGrid(grid);
  let count = 0;

  function solve() {
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if (g[r][c] === 0) {
          for (let num = 1; num <= N; num++) {
            if (isValid(g, r, c, num)) {
              g[r][c] = num;
              solve();
              if (count >= limit) return;
              g[r][c] = 0;
            }
          }
          return;
        }
      }
    }
    count++;
  }

  solve();
  return count;
}

/**
 * Creates a puzzle from a solved grid by removing cells while keeping unique solution.
 * @param {number[][]} solved
 * @param {number} [clueCount=12] — clues to leave; 6x6 minimum unique is ~8, moderate is 12-14
 * @returns {number[][]}
 */
export function createPuzzle(solved, clueCount = 12) {
  const puzzle = copyGrid(solved);
  const positions = [];
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      positions.push([r, c]);
    }
  }
  shuffle(positions);

  let filled = N * N;
  for (const [r, c] of positions) {
    if (filled <= clueCount) break;
    const backup = puzzle[r][c];
    puzzle[r][c] = 0;
    if (countSolutions(puzzle, 2) !== 1) {
      puzzle[r][c] = backup;
    } else {
      filled--;
    }
  }

  return puzzle;
}

/**
 * Validates a completed 6x6 board.
 * @param {number[][]} grid
 * @returns {boolean}
 */
export function isValidBoard(grid) {
  if (!grid || grid.length !== N) return false;

  for (let i = 0; i < N; i++) {
    if (!grid[i] || grid[i].length !== N) return false;

    const rowSet = new Set();
    const colSet = new Set();
    for (let j = 0; j < N; j++) {
      const rv = grid[i][j];
      const cv = grid[j][i];
      if (rv < 1 || rv > N || cv < 1 || cv > N) return false;
      rowSet.add(rv);
      colSet.add(cv);
    }
    if (rowSet.size !== N || colSet.size !== N) return false;
  }

  for (let br = 0; br < N / BOX_ROWS; br++) {
    for (let bc = 0; bc < N / BOX_COLS; bc++) {
      const boxSet = new Set();
      for (let r = br * BOX_ROWS; r < br * BOX_ROWS + BOX_ROWS; r++) {
        for (let c = bc * BOX_COLS; c < bc * BOX_COLS + BOX_COLS; c++) {
          boxSet.add(grid[r][c]);
        }
      }
      if (boxSet.size !== N) return false;
    }
  }

  return true;
}

// --- DOM controller ---

let cleanupFn = null;

export function cleanupSudokuGame() {
  if (cleanupFn) {
    cleanupFn();
    cleanupFn = null;
  }
}

export function initSudokuGame(onComplete) {
  if (cleanupFn) {
    cleanupFn();
    cleanupFn = null;
  }

  const timerEl = document.getElementById('sudoku-timer');
  const gridEl = document.getElementById('sudoku-grid');

  const solved = generateSolvedGrid();
  const puzzle = createPuzzle(solved, 12);

  let selectedRow = -1;
  let selectedCol = -1;
  let timerStarted = false;
  let startTime = 0;
  let rafId = null;
  let completed = false;

  const current = copyGrid(puzzle);

  timerEl.textContent = '00:00.00';

  while (gridEl.firstChild) gridEl.removeChild(gridEl.firstChild);
  gridEl.dataset.size = '6';

  const cells = Array.from({ length: N }, () => Array(N).fill(null));

  for (let r = 0; r < N; r++) {
    const tr = document.createElement('tr');
    for (let c = 0; c < N; c++) {
      const td = document.createElement('td');
      if (puzzle[r][c] !== 0) {
        td.textContent = puzzle[r][c];
        td.classList.add('clue');
      } else {
        td.classList.add('editable');
      }
      td.dataset.row = r;
      td.dataset.col = c;
      td.addEventListener('click', () => selectCell(r, c));
      tr.appendChild(td);
      cells[r][c] = td;
    }
    gridEl.appendChild(tr);
  }

  function selectCell(r, c) {
    selectedRow = r;
    selectedCol = c;
    updateHighlights();
  }

  function updateHighlights() {
    const br = Math.floor(selectedRow / BOX_ROWS) * BOX_ROWS;
    const bc = Math.floor(selectedCol / BOX_COLS) * BOX_COLS;

    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const td = cells[r][c];
        td.classList.remove('selected', 'related');

        if (r === selectedRow && c === selectedCol) {
          td.classList.add('selected');
        } else if (
          r === selectedRow ||
          c === selectedCol ||
          (r >= br && r < br + BOX_ROWS && c >= bc && c < bc + BOX_COLS)
        ) {
          td.classList.add('related');
        }
      }
    }
  }

  function updateConflicts() {
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        cells[r][c].classList.remove('conflict');
      }
    }

    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const val = current[r][c];
        if (val === 0) continue;

        for (let c2 = 0; c2 < N; c2++) {
          if (c2 !== c && current[r][c2] === val) {
            cells[r][c].classList.add('conflict');
            cells[r][c2].classList.add('conflict');
          }
        }

        for (let r2 = 0; r2 < N; r2++) {
          if (r2 !== r && current[r2][c] === val) {
            cells[r][c].classList.add('conflict');
            cells[r2][c].classList.add('conflict');
          }
        }

        const boxR = Math.floor(r / BOX_ROWS) * BOX_ROWS;
        const boxC = Math.floor(c / BOX_COLS) * BOX_COLS;
        for (let r2 = boxR; r2 < boxR + BOX_ROWS; r2++) {
          for (let c2 = boxC; c2 < boxC + BOX_COLS; c2++) {
            if ((r2 !== r || c2 !== c) && current[r2][c2] === val) {
              cells[r][c].classList.add('conflict');
              cells[r2][c2].classList.add('conflict');
            }
          }
        }
      }
    }
  }

  function startTimer() {
    if (timerStarted) return;
    timerStarted = true;
    startTime = performance.now();
    tick();
  }

  function tick() {
    if (completed) return;
    const elapsed = performance.now() - startTime;
    timerEl.textContent = formatTime(elapsed);
    rafId = requestAnimationFrame(tick);
  }

  function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const centiseconds = Math.floor((ms % 1000) / 10);
    return (
      String(minutes).padStart(2, '0') + ':' +
      String(seconds).padStart(2, '0') + '.' +
      String(centiseconds).padStart(2, '0')
    );
  }

  function checkCompletion() {
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if (current[r][c] !== solved[r][c]) return;
      }
    }
    completed = true;
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    const elapsed = performance.now() - startTime;
    const elapsedSeconds = parseFloat((elapsed / 1000).toFixed(2));
    onComplete(elapsedSeconds);
  }

  function handleKeydown(e) {
    if (completed) return;

    if (e.key === 'ArrowUp' || e.key === 'ArrowDown' ||
        e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      if (selectedRow === -1) {
        selectCell(0, 0);
        return;
      }
      let r = selectedRow;
      let c = selectedCol;
      if (e.key === 'ArrowUp') r = (r - 1 + N) % N;
      else if (e.key === 'ArrowDown') r = (r + 1) % N;
      else if (e.key === 'ArrowLeft') c = (c - 1 + N) % N;
      else if (e.key === 'ArrowRight') c = (c + 1) % N;
      selectCell(r, c);
      return;
    }

    if (e.key >= '1' && e.key <= '6') {
      if (selectedRow === -1) return;
      if (puzzle[selectedRow][selectedCol] !== 0) return;
      startTimer();
      const num = parseInt(e.key, 10);
      current[selectedRow][selectedCol] = num;
      cells[selectedRow][selectedCol].textContent = num;
      updateConflicts();
      checkCompletion();
      return;
    }

    if (e.key === 'Backspace' || e.key === 'Delete') {
      if (selectedRow === -1) return;
      if (puzzle[selectedRow][selectedCol] !== 0) return;
      startTimer();
      current[selectedRow][selectedCol] = 0;
      cells[selectedRow][selectedCol].textContent = '';
      updateConflicts();
      return;
    }
  }

  document.addEventListener('keydown', handleKeydown);

  cleanupFn = () => {
    document.removeEventListener('keydown', handleKeydown);
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    completed = true;
  };
}
