// Service worker registration, persistent storage, install-prompt capture.
// PLAN.md §8.1, §10.3, §10.4. Every capability here is feature-detected —
// none of this is a dependency for the app to function.

export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => { /* offline-first still works without SW on first run */ });
    });
  }
}

export async function requestPersistentStorage() {
  try {
    if (navigator.storage?.persist) {
      const already = await navigator.storage.persisted();
      if (!already) await navigator.storage.persist();
    }
  } catch { /* not supported */ }
}

const listeners = new Set();
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  for (const fn of listeners) fn(true);
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  for (const fn of listeners) fn(false);
});

export const installPrompt = {
  get available() { return deferredPrompt != null; },
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  async request() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    for (const fn of listeners) fn(false);
  }
};
