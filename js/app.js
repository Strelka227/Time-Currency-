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

function buildNavRail() {
  navRailEl.replaceChildren();
  for (const item of NAV_ITEMS) {
    const btn = document.createElement('button');
    btn.className = 'nav-btn';
    btn.dataset.screen = item.screen;
    btn.setAttribute('aria-label', item.screen);

    const glyph = document.createElement('span');
    glyph.className = `nav-glyph nav-glyph--${item.shape}`;
    glyph.style.setProperty('--nav-color', item.color);
    glyph.style.setProperty('--nav-glow', item.glow);
    btn.appendChild(glyph);

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
    const glyph = btn.querySelector('.nav-glyph');
    glyph.classList.toggle('active', btn.dataset.screen === screen);
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
