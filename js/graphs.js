// Graphs — per-user performance charts over time (canvas-based, no libraries)

const USERS = ['JL', 'DS', 'DK'];
const GAMES = [
  { key: 'math', label: 'Speed Math', higherIsBetter: true, unit: '' },
  { key: 'memory_digit', label: 'Digit Span', higherIsBetter: true, unit: '' },
  { key: 'reaction', label: 'Reaction', higherIsBetter: false, unit: 'ms' },
  { key: 'minesweeper', label: 'Minesweeper', higherIsBetter: false, unit: 's' },
  { key: 'memory_word', label: 'Word Recall', higherIsBetter: true, unit: '' },
];

// Track currently-rendered charts so we can redraw on resize / theme change
const activeCharts = [];
let resizeBound = false;
let resizeTimer = null;
let themeObserver = null;

// Current display mode: 'all' (every play) or 'daily' (one point per day = daily avg)
let currentMode = 'all';
let lastScores = null;

/**
 * Extract points for a user+game, sorted by time ascending.
 * Skips invalid rows (NaN timestamps or scores).
 */
export function extractSeries(scores, username, game) {
  const out = [];
  for (const s of scores) {
    if (s.username !== username || s.game !== game) continue;
    const t = new Date(s.played_at).getTime();
    const y = Number(s.score);
    if (!Number.isFinite(t) || !Number.isFinite(y)) continue;
    out.push({ t, y });
  }
  out.sort((a, b) => a.t - b.t);
  return out;
}

/**
 * Aggregates a series into one point per local calendar date.
 * Each daily point's y = average of that day's plays; t = noon local for stable ordering.
 * Input series may be in any order; output is sorted ascending by t.
 */
export function aggregateDaily(series) {
  if (!series || series.length === 0) return [];
  const byDate = new Map();
  for (const p of series) {
    const d = new Date(p.t);
    const key = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
    if (!byDate.has(key)) {
      byDate.set(key, {
        sum: 0,
        count: 0,
        t: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0).getTime(),
      });
    }
    const bucket = byDate.get(key);
    bucket.sum += p.y;
    bucket.count++;
  }
  const out = [];
  for (const bucket of byDate.values()) {
    out.push({ t: bucket.t, y: bucket.sum / bucket.count });
  }
  out.sort((a, b) => a.t - b.t);
  return out;
}

/**
 * Min/max y bounds with padding. Uses reduce (not spread) for large-series safety.
 */
export function computeBounds(series) {
  if (series.length === 0) return { min: 0, max: 1 };
  if (series.length === 1) {
    const v = series[0].y;
    return { min: Math.max(0, v - 1), max: v + 1 };
  }
  let min = series[0].y;
  let max = series[0].y;
  for (let i = 1; i < series.length; i++) {
    const y = series[i].y;
    if (y < min) min = y;
    if (y > max) max = y;
  }
  if (max === min) {
    return { min: Math.max(0, min - 1), max: max + 1 };
  }
  const pad = Math.max(1, (max - min) * 0.1);
  return { min: Math.max(0, min - pad), max: max + pad };
}

function formatYLabel(v, unit) {
  const rounded = v >= 100 ? Math.round(v) : Math.round(v * 10) / 10;
  return String(rounded) + (unit || '');
}

function shortDateFromMs(ms) {
  const d = new Date(ms);
  return (d.getMonth() + 1) + '/' + d.getDate();
}

/**
 * Draws a line chart onto a canvas. Safe for zero-dimension canvases.
 */
export function drawLineChart(canvas, series, opts = {}) {
  const W = canvas.clientWidth | 0;
  const H = canvas.clientHeight | 0;
  if (W <= 0 || H <= 0) return; // canvas not laid out yet

  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const ctx = canvas.getContext('2d');

  // Resize fresh (clears and resets transforms)
  canvas.width = Math.floor(W * dpr);
  canvas.height = Math.floor(H * dpr);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);

  // Theme colors
  const style = getComputedStyle(document.documentElement);
  const mutedColor = (style.getPropertyValue('--muted') || '#888').trim();
  const borderColor = (style.getPropertyValue('--border') || '#ccc').trim();
  const accentColor = (style.getPropertyValue('--accent') || '#4a90d9').trim();

  const padL = 36, padR = 8, padT = 8, padB = 22;
  const plotW = Math.max(0, W - padL - padR);
  const plotH = Math.max(0, H - padT - padB);

  // Axes
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padL, padT);
  ctx.lineTo(padL, padT + plotH);
  ctx.lineTo(padL + plotW, padT + plotH);
  ctx.stroke();

  if (series.length === 0) {
    ctx.fillStyle = mutedColor;
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('No data yet', padL + plotW / 2, padT + plotH / 2);
    return;
  }

  const bounds = computeBounds(series);
  const yRange = bounds.max - bounds.min;
  const tMin = series[0].t;
  const tMax = series[series.length - 1].t;
  const tRange = tMax - tMin;

  const toX = (t) => {
    if (series.length === 1 || tRange === 0) return padL + plotW / 2;
    return padL + ((t - tMin) / tRange) * plotW;
  };
  const toY = (y) => {
    if (yRange === 0) return padT + plotH / 2;
    return padT + plotH - ((y - bounds.min) / yRange) * plotH;
  };

  // Y-axis labels
  ctx.fillStyle = mutedColor;
  ctx.font = '10px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(formatYLabel(bounds.max, opts.unit), padL - 4, padT + 4);
  ctx.fillText(formatYLabel(bounds.min, opts.unit), padL - 4, padT + plotH - 4);

  // X-axis labels
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  if (series.length === 1 || tRange === 0) {
    ctx.fillText(shortDateFromMs(tMin), padL + plotW / 2, padT + plotH + 4);
  } else {
    ctx.textAlign = 'left';
    ctx.fillText(shortDateFromMs(tMin), padL, padT + plotH + 4);
    ctx.textAlign = 'right';
    ctx.fillText(shortDateFromMs(tMax), padL + plotW, padT + plotH + 4);
  }

  // Line
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i < series.length; i++) {
    const x = toX(series[i].t);
    const y = toY(series[i].y);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Points
  ctx.fillStyle = accentColor;
  for (const p of series) {
    ctx.beginPath();
    ctx.arc(toX(p.t), toY(p.y), 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function redrawAll() {
  for (const chart of activeCharts) {
    drawLineChart(chart.canvas, chart.series, chart.opts);
  }
}

function bindResize() {
  if (resizeBound) return;
  resizeBound = true;

  window.addEventListener('resize', () => {
    if (resizeTimer !== null) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resizeTimer = null;
      redrawAll();
    }, 100);
  });

  // Redraw on theme change (theme is set via data-theme on <html>)
  if ('MutationObserver' in window) {
    themeObserver = new MutationObserver(() => redrawAll());
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }
}

/**
 * Renders the graphs page: 3 user columns, each with charts for all 5 games.
 * Respects currentMode ('all' or 'daily').
 */
export function renderGraphs(scores) {
  lastScores = scores;
  const container = document.getElementById('graphs-container');
  while (container.firstChild) container.removeChild(container.firstChild);
  activeCharts.length = 0;

  for (const user of USERS) {
    const col = document.createElement('div');
    col.className = 'graph-column';

    const title = document.createElement('h3');
    title.className = 'graph-column-title';
    title.textContent = user;
    col.appendChild(title);

    for (const game of GAMES) {
      const card = document.createElement('div');
      card.className = 'graph-card';

      const label = document.createElement('div');
      label.className = 'graph-label';
      const arrow = game.higherIsBetter ? '↑' : '↓';
      label.textContent = `${game.label} (${arrow} better)`;
      card.appendChild(label);

      const canvas = document.createElement('canvas');
      canvas.className = 'graph-canvas';
      card.appendChild(canvas);

      col.appendChild(card);

      const rawSeries = extractSeries(scores, user, game.key);
      const series = currentMode === 'daily' ? aggregateDaily(rawSeries) : rawSeries;
      const opts = { higherIsBetter: game.higherIsBetter, unit: game.unit };
      activeCharts.push({ canvas, series, opts });
    }

    container.appendChild(col);
  }

  updateModeButtons();

  // Single RAF to draw all charts after layout is settled
  requestAnimationFrame(() => {
    redrawAll();
    bindResize();
  });
}

function updateModeButtons() {
  document.querySelectorAll('.graphs-mode-btn').forEach(btn => {
    if (btn.dataset.mode === currentMode) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

/**
 * Changes the display mode and re-renders with the last-known scores.
 * @param {'all' | 'daily'} mode
 */
export function setGraphsMode(mode) {
  if (mode !== 'all' && mode !== 'daily') return;
  if (mode === currentMode) return;
  currentMode = mode;
  if (lastScores !== null) renderGraphs(lastScores);
}
