// Boot, hash routing, nav rail. PLAN.md §4 (routing), §10.5 (back gesture).
import homeView from './views/home.js';
import earnView from './views/earn.js';
import spendView from './views/spend.js';
import logView from './views/log.js';
import { registerServiceWorker, requestPersistentStorage } from './pwa.js';

const VIEWS = { home: homeView, earn: earnView, spend: spendView, log: logView };

const NAV_ITEMS = [
  { screen: 'home', shape: 'diamond', color: '#6ee7a8', glow: 'rgba(110,231,168,.7)' },
  { screen: 'earn', shape: 'square', color: '#a8e85f', glow: 'rgba(168,232,95,.7)' },
  { screen: 'spend', shape: 'triangle', color: '#ffab4d', glow: 'rgba(255,171,77,.7)' },
  { screen: 'log', shape: 'bars', color: '#6ee7a8', glow: 'rgba(110,231,168,.7)' }
];

const appEl = document.getElementById('app');
const screenEl = document.getElementById('screen');
const navRailEl = document.getElementById('navRail');

let currentCleanup = null;

const SVGNS = 'http://www.w3.org/2000/svg';

// Nav glyphs are real SVG shapes, not clip-path'd divs — a CSS `border`
// on a clip-path'd box gets clipped along with everything else, which is
// what made the unselected diamond/triangle render as corrupted partial
// shapes. SVG stroke/fill has no such problem: inactive is a clean hollow
// outline of the same shape, active is the shape filled solid + glowing.
function buildGlyphSvg(shape) {
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.classList.add('nav-glyph-svg');

  if (shape === 'diamond' || shape === 'triangle') {
    const points = shape === 'diamond' ? '8,1 15,8 8,15 1,8' : '8,1 15,15 1,15';
    const poly = document.createElementNS(SVGNS, 'polygon');
    poly.setAttribute('points', points);
    poly.classList.add('nav-glyph-shape');
    svg.appendChild(poly);
  } else if (shape === 'square') {
    const rect = document.createElementNS(SVGNS, 'rect');
    rect.setAttribute('x', '1.5');
    rect.setAttribute('y', '1.5');
    rect.setAttribute('width', '13');
    rect.setAttribute('height', '13');
    rect.classList.add('nav-glyph-shape');
    svg.appendChild(rect);
  } else if (shape === 'bars') {
    for (const y of [3, 8, 13]) {
      const line = document.createElementNS(SVGNS, 'line');
      line.setAttribute('x1', '1');
      line.setAttribute('x2', '15');
      line.setAttribute('y1', String(y));
      line.setAttribute('y2', String(y));
      line.classList.add('nav-glyph-bar');
      svg.appendChild(line);
    }
  }
  return svg;
}

function buildNavRail() {
  navRailEl.replaceChildren();
  for (const item of NAV_ITEMS) {
    const btn = document.createElement('button');
    btn.className = 'nav-btn';
    btn.dataset.screen = item.screen;
    btn.setAttribute('aria-label', item.screen);
    btn.style.setProperty('--nav-color', item.color);
    btn.style.setProperty('--nav-glow', item.glow);

    btn.appendChild(buildGlyphSvg(item.shape));

    btn.addEventListener('click', () => {
      if (location.hash !== `#/${item.screen}`) location.hash = `#/${item.screen}`;
    });
    navRailEl.appendChild(btn);
  }
  const version = document.createElement('div');
  version.className = 'nav-version';
  version.textContent = 'V 1.0';
  navRailEl.appendChild(version);
}

function updateNavActive(screen) {
  for (const btn of navRailEl.querySelectorAll('.nav-btn')) {
    btn.classList.toggle('active', btn.dataset.screen === screen);
  }
}

function normalizeHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  if (!VIEWS[raw]) {
    history.replaceState(null, '', '#/home');
    return 'home';
  }
  return raw;
}

function render() {
  const screen = normalizeHash();
  appEl.dataset.screen = screen;
  updateNavActive(screen);
  if (currentCleanup) {
    try { currentCleanup(); } catch { /* view cleanup should not block navigation */ }
    currentCleanup = null;
  }
  screenEl.replaceChildren();
  currentCleanup = VIEWS[screen].mount(screenEl) || null;
}

window.addEventListener('hashchange', render);

buildNavRail();
render();

registerServiceWorker();
requestPersistentStorage();
