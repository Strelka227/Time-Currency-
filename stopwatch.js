// Wall-clock-derived stopwatch. PLAN.md §9.
//
// Never increments a counter — Chrome throttles/freezes/discards background
// tabs, so a counter silently under-reports. Instead we store {running,
// startedAt, accumulatedSec} and always recompute elapsed from Date.now().
// A frozen page simply renders the correct total the moment it thaws.

export function elapsedSec(sw) {
  return sw.accumulatedSec + (sw.running ? Math.floor((Date.now() - sw.startedAt) / 1000) : 0);
}

export function start(sw) {
  sw.running = true;
  sw.startedAt = Date.now();
}

export function stop(sw) {
  sw.accumulatedSec = elapsedSec(sw);
  sw.running = false;
  sw.startedAt = null;
}

export function reset(sw) {
  sw.running = false;
  sw.startedAt = null;
  sw.accumulatedSec = 0;
}

// --- wake lock (Android bonus, §9) ---
// A nicety, never a dependency: every call is feature-detected and
// failures are swallowed silently.

let wakeLock = null;

export async function acquireWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
    }
  } catch {
    wakeLock = null;
  }
}

export async function releaseWakeLock() {
  try {
    await wakeLock?.release();
  } catch { /* already released */ }
  wakeLock = null;
}

export function hasWakeLock() {
  return wakeLock != null;
}
