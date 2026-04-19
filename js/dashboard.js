// Dashboard — stats, heatmaps, per-user score tables

const USERS = ['JL', 'DS', 'DK'];
// Sudoku hidden from UI; code retained. Active games (order: memory/attention first):
const GAMES = ['math', 'memory_digit', 'nback', 'stroop', 'reaction', 'minesweeper', 'memory_word'];

const GAME_LABELS = {
  math: 'Speed Math',
  sudoku: 'Sudoku',
  reaction: 'Reaction',
  memory_digit: 'Digit Span',
  memory_word: 'Word Recall',
  minesweeper: 'Minesweeper',
  nback: 'N-Back',
  stroop: 'Stroop',
};

// true = higher score is better; false = lower score is better
const HIGHER_IS_BETTER = {
  math: true,
  sudoku: false,
  reaction: false,
  memory_digit: true,
  memory_word: true,
  minesweeper: false,
  nback: true,
  stroop: true,
};

/** Returns the best (top) score from an array, respecting game direction. */
export function bestScore(scoresArr, game) {
  if (!scoresArr || scoresArr.length === 0) return null;
  const higher = HIGHER_IS_BETTER[game];
  let best = scoresArr[0];
  for (let i = 1; i < scoresArr.length; i++) {
    const v = scoresArr[i];
    if (higher ? v > best : v < best) best = v;
  }
  return best;
}

// Heatmap window — fixed start, extends forward as time progresses
const HEATMAP_START = '2026-04-18';
const HEATMAP_FORWARD_DAYS = 90;

/**
 * Extracts local date string (YYYY-MM-DD) from a timestamp.
 */
function toLocalDate(timestamp) {
  const d = new Date(timestamp);
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

function dateToLocalString(d) {
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

/** Short display date like "4/18" from a YYYY-MM-DD string. */
function shortDate(isoDateStr) {
  const [, m, d] = isoDateStr.split('-');
  return `${parseInt(m, 10)}/${parseInt(d, 10)}`;
}

/**
 * Returns [startDate, endDate] for the heatmap window (both Date objects, midnight local).
 * Start = max(HEATMAP_START, today - 89) so the window always includes today.
 * End = today + HEATMAP_FORWARD_DAYS.
 * As time moves forward, the window grows (expandable).
 */
export function heatmapRange(today = new Date()) {
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const minStart = new Date(HEATMAP_START + 'T00:00:00');
  const start = t < minStart ? minStart : new Date(minStart);
  const end = new Date(t);
  end.setDate(end.getDate() + HEATMAP_FORWARD_DAYS);
  return { start, end };
}

/** Returns number of days between two local-midnight dates (inclusive of both). */
function daysBetween(start, end) {
  const ms = end.getTime() - start.getTime();
  return Math.round(ms / 86400000) + 1;
}

export function median(arr) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function mean(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export function computeStats(scores, username, game) {
  const userGameScores = scores
    .filter(s => s.username === username && s.game === game)
    .map(s => Number(s.score));

  const allTime = {
    median: median(userGameScores),
    mean: mean(userGameScores),
    count: userGameScores.length,
    best: bestScore(userGameScores, game),
  };

  const dateMap = new Map();
  scores
    .filter(s => s.username === username && s.game === game)
    .forEach(s => {
      const dateStr = toLocalDate(s.played_at);
      if (!dateMap.has(dateStr)) dateMap.set(dateStr, []);
      dateMap.get(dateStr).push(Number(s.score));
    });

  const sortedDates = [...dateMap.keys()].sort().reverse().slice(0, 5);
  const last5Scores = sortedDates.flatMap(d => dateMap.get(d));

  const last5Days = {
    median: median(last5Scores),
    mean: mean(last5Scores),
    count: last5Scores.length,
  };

  return { allTime, last5Days };
}

export function buildHeatmapData(scores, username) {
  const dates = new Set();
  scores
    .filter(s => s.username === username)
    .forEach(s => dates.add(toLocalDate(s.played_at)));
  return dates;
}

/**
 * Groups a user's scores into row-packed per-date rows, one column per game.
 * All 5 games supported. Newest date first; within a date, earliest play first.
 */
export function buildDailyRuns(scores, username) {
  const userScores = scores
    .filter(s => s.username === username)
    .slice()
    .sort((a, b) => new Date(a.played_at) - new Date(b.played_at));

  const byDate = new Map();
  for (const s of userScores) {
    const d = toLocalDate(s.played_at);
    if (!byDate.has(d)) {
      byDate.set(d, { math: [], minesweeper: [], reaction: [], memory_digit: [], memory_word: [], nback: [], stroop: [] });
    }
    const bucket = byDate.get(d);
    if (bucket[s.game]) bucket[s.game].push(Number(s.score));
  }

  const sortedDates = [...byDate.keys()].sort().reverse();
  const rows = [];

  for (const date of sortedDates) {
    const bucket = byDate.get(date);
    const rowCount = Math.max(
      bucket.math.length,
      bucket.minesweeper.length,
      bucket.reaction.length,
      bucket.memory_digit.length,
      bucket.memory_word.length,
      bucket.nback.length,
      bucket.stroop.length,
    );

    const dayRuns = [];
    for (let i = 0; i < rowCount; i++) {
      dayRuns.push({
        math: i < bucket.math.length ? bucket.math[i] : null,
        minesweeper: i < bucket.minesweeper.length ? bucket.minesweeper[i] : null,
        reaction: i < bucket.reaction.length ? bucket.reaction[i] : null,
        memory_digit: i < bucket.memory_digit.length ? bucket.memory_digit[i] : null,
        memory_word: i < bucket.memory_word.length ? bucket.memory_word[i] : null,
        nback: i < bucket.nback.length ? bucket.nback[i] : null,
        stroop: i < bucket.stroop.length ? bucket.stroop[i] : null,
      });
    }

    rows.push({ date, dateLabel: shortDate(date), runs: dayRuns });
  }

  return rows;
}

/** Formats a score for display; returns '' for null/undefined. */
export function formatScore(game, score) {
  if (score === null || score === undefined) return '';
  const n = Number(score);
  if (game === 'math') return `${n}`;
  if (game === 'sudoku' || game === 'minesweeper') {
    const mins = Math.floor(n / 60);
    const secs = (n % 60).toFixed(2);
    return mins > 0 ? `${mins}:${secs.padStart(5, '0')}` : `${secs}s`;
  }
  if (game === 'reaction') return `${Math.round(n)}ms`;
  if (game === 'memory_digit') return `${n} digits`;
  if (game === 'memory_word') return `${n}/10`;
  if (game === 'nback') return `${Math.round(n)}%`;
  if (game === 'stroop') return `${n}`;
  return String(n);
}

/**
 * Compact score format for dense table cells.
 * Drops unit suffixes; keeps just the number. Minesweeper/sudoku keep seconds since time is structural.
 */
export function formatScoreCompact(game, score) {
  if (score === null || score === undefined) return '';
  const n = Number(score);
  if (game === 'math') return `${n}`;
  if (game === 'memory_digit') return `${n}`;
  if (game === 'memory_word') return `${n}`;
  if (game === 'nback') return `${Math.round(n)}`;
  if (game === 'stroop') return `${n}`;
  if (game === 'reaction') return `${Math.round(n)}`;
  if (game === 'sudoku' || game === 'minesweeper') {
    const mins = Math.floor(n / 60);
    const secs = Math.round(n % 60);
    return mins > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : `${Math.round(n)}`;
  }
  return String(n);
}

// --- DOM rendering ---

export function renderDashboard(scores) {
  renderUserColumns(scores);
  renderUserTables(scores);
}

function renderUserColumns(scores) {
  const container = document.getElementById('user-columns');
  while (container.firstChild) container.removeChild(container.firstChild);

  for (const user of USERS) {
    const col = document.createElement('div');
    col.className = 'user-column';

    const title = document.createElement('h3');
    title.className = 'user-column-title';
    title.textContent = user;
    col.appendChild(title);

    col.appendChild(buildHeatmapElement(scores, user));

    for (const game of GAMES) {
      col.appendChild(buildStatCard(scores, user, game));
    }

    container.appendChild(col);
  }
}

function buildHeatmapElement(scores, user) {
  const playedDates = buildHeatmapData(scores, user);
  const wrap = document.createElement('div');
  wrap.className = 'heatmap-wrap';

  const label = document.createElement('div');
  label.className = 'heatmap-label';
  const { start, end } = heatmapRange();
  label.textContent = `Activity: ${dateToLocalString(start)} → ${dateToLocalString(end)}`;
  wrap.appendChild(label);

  const grid = document.createElement('div');
  grid.className = 'heatmap-grid';

  const total = daysBetween(start, end);
  for (let i = 0; i < total; i++) {
    const date = new Date(start);
    date.setDate(date.getDate() + i);
    const dateStr = dateToLocalString(date);

    const cell = document.createElement('div');
    cell.className = 'heatmap-cell';
    if (playedDates.has(dateStr)) cell.classList.add('played');
    cell.title = dateStr;
    grid.appendChild(cell);
  }

  wrap.appendChild(grid);
  return wrap;
}

function buildStatCard(scores, user, game) {
  const card = document.createElement('div');
  card.className = 'stat-card';

  const title = document.createElement('h4');
  title.textContent = GAME_LABELS[game];
  card.appendChild(title);

  const stats = computeStats(scores, user, game);

  // Top score row — always visible at the top of the card
  const topRow = document.createElement('div');
  topRow.className = 'stat-row stat-top';
  const topLabel = document.createElement('span');
  topLabel.className = 'stat-label';
  topLabel.textContent = 'Top';
  const topVal = document.createElement('span');
  topVal.className = 'stat-top-value';
  topVal.textContent = stats.allTime.best !== null
    ? formatScore(game, stats.allTime.best)
    : '-';
  topRow.appendChild(topLabel);
  topRow.appendChild(topVal);
  card.appendChild(topRow);

  // Everything else collapsed inside <details>
  const details = document.createElement('details');
  details.className = 'stat-details';

  const summary = document.createElement('summary');
  summary.textContent = 'More';
  details.appendChild(summary);

  const rows = [
    ['All-time Median', formatStatValue(game, stats.allTime.median)],
    ['All-time Mean', formatStatValue(game, stats.allTime.mean)],
    ['Last 5d Median', formatStatValue(game, stats.last5Days.median)],
    ['Last 5d Mean', formatStatValue(game, stats.last5Days.mean)],
    ['Total Plays', String(stats.allTime.count)],
  ];

  for (const [label, value] of rows) {
    const row = document.createElement('div');
    row.className = 'stat-row';
    const labelEl = document.createElement('span');
    labelEl.className = 'stat-label';
    labelEl.textContent = label;
    const valEl = document.createElement('span');
    valEl.textContent = value;
    row.appendChild(labelEl);
    row.appendChild(valEl);
    details.appendChild(row);
  }

  card.appendChild(details);
  return card;
}

function formatStatValue(game, value) {
  if (value === 0) return '-';
  return formatScore(game, value);
}

function renderUserTables(scores) {
  const container = document.getElementById('score-table-container');
  while (container.firstChild) container.removeChild(container.firstChild);

  if (scores.length === 0) {
    const msg = document.createElement('p');
    msg.textContent = 'No scores yet. Play a game to get started!';
    msg.style.textAlign = 'center';
    msg.style.color = 'var(--muted)';
    container.appendChild(msg);
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'user-tables-grid';

  // Column order matches dashboard GAMES order (minus N-Back/Stroop both fit)
  const COL_GAMES = ['math', 'memory_digit', 'nback', 'stroop', 'reaction', 'minesweeper', 'memory_word'];
  const COL_HEADERS = ['Math', 'Dig', 'NB', 'Str', 'Rxn', 'Mine', 'Wrd'];
  const TOTAL_COLS = COL_GAMES.length;

  for (const user of USERS) {
    const card = document.createElement('div');
    card.className = 'user-table-card';

    const title = document.createElement('h3');
    title.className = 'user-table-title';
    title.textContent = user;
    card.appendChild(title);

    const days = buildDailyRuns(scores, user); // newest-first, each with { date, dateLabel, runs }

    if (days.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'user-table-empty';
      empty.textContent = 'No plays yet.';
      card.appendChild(empty);
      grid.appendChild(card);
      continue;
    }

    const table = document.createElement('table');
    table.className = 'score-table user-score-table';

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    for (const h of COL_HEADERS) {
      const th = document.createElement('th');
      th.textContent = h;
      headerRow.appendChild(th);
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    for (const day of days) {
      // Date row: spans all columns
      const dateTr = document.createElement('tr');
      dateTr.className = 'date-row';
      const dateTd = document.createElement('td');
      dateTd.colSpan = TOTAL_COLS;
      dateTd.textContent = day.dateLabel;
      dateTr.appendChild(dateTd);
      tbody.appendChild(dateTr);

      // Run rows
      for (const run of day.runs) {
        const tr = document.createElement('tr');
        for (const g of COL_GAMES) {
          const cell = document.createElement('td');
          cell.textContent = formatScoreCompact(g, run[g]);
          tr.appendChild(cell);
        }
        tbody.appendChild(tr);
      }
    }
    table.appendChild(tbody);
    card.appendChild(table);
    grid.appendChild(card);
  }

  container.appendChild(grid);
}
