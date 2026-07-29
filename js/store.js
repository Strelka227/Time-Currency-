// State, persistence, derived values. PLAN.md §8.
import { isSameDay, startOfDayMs } from './format.js';

const KEY = 'timecurrency.v1';

function defaultState() {
  return {
    version: 1,
    entries: [],
    draft: {
      earn: { mode: 'stopwatch', category: 'schoolwork', manualMin: 45,
        running: false, startedAt: null, accumulatedSec: 0, sessionStartedAt: null },
      spend: { mode: 'stopwatch', app: 'TIKTOK', manualMin: 20,
        running: false, startedAt: null, accumulatedSec: 0, sessionStartedAt: null }
    }
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.entries)) return defaultState();
    const d = defaultState();
    parsed.draft = {
      earn: { ...d.draft.earn, ...(parsed.draft && parsed.draft.earn) },
      spend: { ...d.draft.spend, ...(parsed.draft && parsed.draft.spend) }
    };
    return parsed;
  } catch {
    return defaultState();
  }
}

let state = load();
const listeners = new Set();

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage unavailable */ }
}

function notify() {
  for (const fn of listeners) fn(state);
}

export const store = {
  getState() {
    return state;
  },

  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  balanceSec() {
    let n = 0;
    for (const e of state.entries) n += e.deltaSec;
    return n;
  },

  entriesSorted() {
    // newest first
    return [...state.entries].sort((a, b) => b.endedAt - a.endedAt);
  },

  todayEntries(type) {
    const now = Date.now();
    return state.entries.filter(e => (!type || e.type === type) && isSameDay(e.endedAt, now));
  },

  addEntry(entry) {
    state.entries.push(entry);
    persist();
    notify();
  },

  deleteEntry(id) {
    const idx = state.entries.findIndex(e => e.id === id);
    if (idx === -1) return null;
    const [removed] = state.entries.splice(idx, 1);
    persist();
    notify();
    return removed;
  },

  restoreEntry(entry) {
    state.entries.push(entry);
    persist();
    notify();
  },

  updateDraft(screen, patch) {
    Object.assign(state.draft[screen], patch);
    persist();
  },

  // Consecutive days ending today with >=1 earn entry.
  earnStreak() {
    const days = new Set(state.entries.filter(e => e.type === 'earn').map(e => startOfDayMs(e.endedAt)));
    let streak = 0;
    let cursor = startOfDayMs(Date.now());
    const dayMs = 86400000;
    while (days.has(cursor)) {
      streak++;
      cursor -= dayMs;
    }
    return streak;
  },

  replaceAll(next) {
    state = next;
    persist();
    notify();
  },

  exportPayload() {
    return JSON.stringify(state, null, 2);
  }
};

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') persist();
});
window.addEventListener('pagehide', persist);
