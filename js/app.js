import { authenticateUser, fetchScores, submitScore } from './db.js';
import { initMathGame, cleanupMathGame } from './math.js';
import { initSudokuGame, cleanupSudokuGame } from './sudoku.js';
import { initReactionGame, cleanupReactionGame } from './reaction.js';
import { initDigitGame, cleanupDigitGame } from './digit.js';
import { initWordGame, cleanupWordGame } from './word.js';
import { initMinesweeperGame, cleanupMinesweeperGame } from './minesweeper.js';
import { renderDashboard } from './dashboard.js';
import { renderGraphs } from './graphs.js';

// --- Screen routing ---
export function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// --- Auth state ---
export function getUser() { return sessionStorage.getItem('mg_user'); }
export function setUser(u) { sessionStorage.setItem('mg_user', u); }
export function clearUser() { sessionStorage.removeItem('mg_user'); }

// --- Game cleanup ---
function cleanupAllGames() {
  cleanupMathGame();
  cleanupSudokuGame();
  cleanupReactionGame();
  cleanupDigitGame();
  cleanupWordGame();
  cleanupMinesweeperGame();
  document.querySelectorAll('.result-overlay').forEach(o => o.classList.remove('active'));
}

// --- Theme (per-user) ---
function themeKey() {
  const u = getUser();
  return u ? `mg_theme_${u}` : 'mg_theme_default';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.textContent = theme === 'light' ? '☾' : '☀';
}

export function loadUserTheme() {
  const theme = localStorage.getItem(themeKey()) || 'light';
  applyTheme(theme);
}

function initTheme() {
  loadUserTheme();
  const btn = document.getElementById('theme-toggle');
  btn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'light' ? 'dark' : 'light';
    applyTheme(next);
    localStorage.setItem(themeKey(), next);
  });
}

// --- Data loading ---
let cachedScores = null;

async function fetchAndRender(view) {
  try {
    cachedScores = await fetchScores();
    if (view === 'dashboard') renderDashboard(cachedScores);
    else if (view === 'graphs') renderGraphs(cachedScores);
  } catch (e) {
    const containerId = view === 'dashboard' ? 'user-columns' : 'graphs-container';
    const container = document.getElementById(containerId);
    while (container.firstChild) container.removeChild(container.firstChild);
    const err = document.createElement('div');
    err.className = 'error';
    err.textContent = 'Could not load scores. ';
    const retryBtn = document.createElement('button');
    retryBtn.textContent = 'Retry';
    retryBtn.addEventListener('click', () => fetchAndRender(view));
    err.appendChild(retryBtn);
    container.appendChild(err);
  }
}

async function loadDashboard() {
  const userColumns = document.getElementById('user-columns');
  const tableContainer = document.getElementById('score-table-container');
  while (userColumns.firstChild) userColumns.removeChild(userColumns.firstChild);
  while (tableContainer.firstChild) tableContainer.removeChild(tableContainer.firstChild);
  const loadingEl = document.createElement('div');
  loadingEl.className = 'loading';
  loadingEl.textContent = 'Loading scores...';
  userColumns.appendChild(loadingEl);
  await fetchAndRender('dashboard');
}

async function loadGraphs() {
  const container = document.getElementById('graphs-container');
  while (container.firstChild) container.removeChild(container.firstChild);
  const loadingEl = document.createElement('div');
  loadingEl.className = 'loading';
  loadingEl.textContent = 'Loading scores...';
  container.appendChild(loadingEl);
  await fetchAndRender('graphs');
}

// --- Score submission flow ---
function showResult(screenId, game, score, formatFn) {
  const overlay = document.querySelector(`#${screenId} .result-overlay`);
  overlay.querySelector('.result-score').textContent = formatFn(score);
  overlay.querySelector('.result-status').textContent = '';
  overlay.classList.add('active');

  const submitBtn = overlay.querySelector('.btn-submit');
  const retryBtn = overlay.querySelector('.btn-retry');
  const status = overlay.querySelector('.result-status');

  const newSubmit = submitBtn.cloneNode(true);
  submitBtn.parentNode.replaceChild(newSubmit, submitBtn);

  const newRetry = retryBtn.cloneNode(true);
  retryBtn.parentNode.replaceChild(newRetry, retryBtn);

  newSubmit.disabled = false;
  newRetry.disabled = false;

  if (score <= 0) {
    newSubmit.disabled = true;
    status.textContent = 'Score too low to submit.';
  }

  newSubmit.addEventListener('click', async () => {
    newSubmit.disabled = true;
    status.textContent = 'Saving...';
    try {
      await submitScore(getUser(), game, score);
      overlay.classList.remove('active');
      showScreen('screen-dashboard');
      loadDashboard();
    } catch (e) {
      status.textContent = 'Error saving. Try again.';
      newSubmit.disabled = false;
    }
  });

  newRetry.addEventListener('click', () => {
    overlay.classList.remove('active');
    startGame(game);
  });
}

/**
 * Loss-mode overlay: shows only Retry, no Submit.
 * Used when a game ends without a valid score (e.g., minesweeper mine hit).
 */
function showLossResult(screenId, game, message) {
  const overlay = document.querySelector(`#${screenId} .result-overlay`);
  overlay.querySelector('.result-score').textContent = message;
  overlay.querySelector('.result-status').textContent = '';
  overlay.classList.add('active');

  const submitBtn = overlay.querySelector('.btn-submit');
  const retryBtn = overlay.querySelector('.btn-retry');

  // Replace the submit button with a hidden clone so we don't leak listeners
  const newSubmit = submitBtn.cloneNode(true);
  submitBtn.parentNode.replaceChild(newSubmit, submitBtn);
  newSubmit.hidden = true;

  const newRetry = retryBtn.cloneNode(true);
  retryBtn.parentNode.replaceChild(newRetry, retryBtn);
  newRetry.disabled = false;

  newRetry.addEventListener('click', () => {
    overlay.classList.remove('active');
    newSubmit.hidden = false; // restore for next round
    startGame(game);
  });
}

function startGame(game) {
  cleanupAllGames();
  if (game === 'math') {
    showScreen('screen-math');
    initMathGame((score) => showResult('screen-math', 'math', score, (s) => `${s} problems`));
  } else if (game === 'sudoku') {
    showScreen('screen-sudoku');
    initSudokuGame((score) => showResult('screen-sudoku', 'sudoku', score, (s) => `${s.toFixed(2)} seconds`));
  } else if (game === 'reaction') {
    showScreen('screen-reaction');
    initReactionGame((score) => showResult('screen-reaction', 'reaction', score, (s) => `${Math.round(s)} ms`));
  } else if (game === 'memory_digit') {
    showScreen('screen-digit');
    initDigitGame((score) => showResult('screen-digit', 'memory_digit', score, (s) => `${s} digits`));
  } else if (game === 'memory_word') {
    showScreen('screen-word');
    initWordGame((score) => showResult('screen-word', 'memory_word', score, (s) => `${s} / 10 words`));
  } else if (game === 'minesweeper') {
    showScreen('screen-minesweeper');
    initMinesweeperGame(
      (score) => showResult('screen-minesweeper', 'minesweeper', score, (s) => `${s.toFixed(2)} seconds`),
      () => showLossResult('screen-minesweeper', 'minesweeper', 'You hit a mine!'),
    );
  }
}

function quitGame() {
  cleanupAllGames();
  showScreen('screen-select');
}

// --- Init ---
document.addEventListener('DOMContentLoaded', () => {
  initTheme();

  const logoutBtn = document.getElementById('logout-btn');
  const userDisplay = document.getElementById('user-display');

  if (getUser()) {
    userDisplay.textContent = getUser();
    logoutBtn.hidden = false;
    showScreen('screen-dashboard');
    loadDashboard();
  } else {
    showScreen('screen-login');
  }

  // Login
  const loginForm = document.getElementById('login-form');
  const loginError = document.getElementById('login-error');
  const loginBtn = document.getElementById('login-btn');

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-user').value.trim().toUpperCase();
    const password = document.getElementById('login-pass').value;
    loginBtn.disabled = true;
    loginError.textContent = '';

    try {
      const success = await authenticateUser(username, password);
      if (success) {
        setUser(username);
        userDisplay.textContent = username;
        logoutBtn.hidden = false;
        loginForm.reset();
        loadUserTheme();
        showScreen('screen-dashboard');
        loadDashboard();
      } else {
        loginError.textContent = 'Invalid username or password';
      }
    } catch (e) {
      loginError.textContent = 'Connection error. Try again.';
    }
    loginBtn.disabled = false;
  });

  // Logout
  logoutBtn.addEventListener('click', () => {
    cleanupAllGames();
    clearUser();
    userDisplay.textContent = '';
    logoutBtn.hidden = true;
    loadUserTheme();
    showScreen('screen-login');
  });

  // Tabs (Dashboard / Graphs) — both screens have tab elements
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      if (target === 'dashboard') {
        showScreen('screen-dashboard');
        loadDashboard();
      } else if (target === 'graphs') {
        showScreen('screen-graphs');
        loadGraphs();
      }
    });
  });

  // Start game buttons (one on each of dashboard/graphs)
  const startBtn = document.getElementById('btn-start-game');
  const startBtn2 = document.getElementById('btn-start-game-2');
  const goToSelect = () => showScreen('screen-select');
  if (startBtn) startBtn.addEventListener('click', goToSelect);
  if (startBtn2) startBtn2.addEventListener('click', goToSelect);

  // Game selection
  document.getElementById('btn-math').addEventListener('click', () => startGame('math'));
  document.getElementById('btn-sudoku').addEventListener('click', () => startGame('sudoku'));
  document.getElementById('btn-reaction').addEventListener('click', () => startGame('reaction'));
  document.getElementById('btn-digit').addEventListener('click', () => startGame('memory_digit'));
  document.getElementById('btn-word').addEventListener('click', () => startGame('memory_word'));
  document.getElementById('btn-minesweeper').addEventListener('click', () => startGame('minesweeper'));
  document.getElementById('btn-back-dashboard').addEventListener('click', () => {
    showScreen('screen-dashboard');
  });

  // Quit buttons
  document.querySelectorAll('.btn-quit').forEach(btn => {
    btn.addEventListener('click', quitGame);
  });
});
