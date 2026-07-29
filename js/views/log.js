// History / log. PLAN.md §6.4 (not designed — derived from the other three)
// plus export/import (§8.2).
import { store } from '../store.js';
import { fmtHM, dayLabel } from '../format.js';
import { h, divider, entryCard, emptyCard, vibrate, chip } from '../ui.js';

const LONG_PRESS_MS = 550;

function download(filename, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function exportData() {
  const json = store.exportPayload();
  const filename = `time-currency-backup-${new Date().toISOString().slice(0, 10)}.json`;
  try {
    if (navigator.canShare && navigator.canShare({ files: [new File([json], filename, { type: 'application/json' })] })) {
      await navigator.share({ files: [new File([json], filename, { type: 'application/json' })], title: 'Time Currency backup' });
      return;
    }
  } catch { /* fall through to download */ }
  download(filename, json);
}

function validateImport(parsed) {
  if (!parsed || typeof parsed !== 'object') return false;
  if (parsed.version !== 1) return false;
  if (!Array.isArray(parsed.entries)) return false;
  return parsed.entries.every(e => e && typeof e.id === 'string' && typeof e.deltaSec === 'number' && typeof e.endedAt === 'number' && (e.type === 'earn' || e.type === 'spend'));
}

export default {
  mount(root) {
    let filter = 'all'; // 'all' | 'earn' | 'spend'
    let toast = null;
    let toastTimer = null;
    let popStateHandler = null;
    let pressTimer = null;
    let pressMoved = false;

    // Clears the toast UI only — does not touch history. Used both by the
    // programmatic path (below) and by the popstate path, which must NOT
    // call history.back() itself since the browser already did that.
    function clearToastUI() {
      if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
      if (popStateHandler) { window.removeEventListener('popstate', popStateHandler); popStateHandler = null; }
      if (toast) { toast.remove(); toast = null; }
    }

    // Programmatic dismiss (undo click, timeout, or unmount): also consumes
    // the dummy history entry pushed in showUndoToast so it doesn't linger.
    function dismissToast() {
      const hadPopHandler = popStateHandler != null;
      clearToastUI();
      if (hadPopHandler) history.back();
    }

    function showUndoToast(removedEntry) {
      clearToastUI();
      history.pushState({ tcToast: true }, '', location.href);
      popStateHandler = () => clearToastUI(); // back already happened — just clean up
      window.addEventListener('popstate', popStateHandler);

      toast = h('div', { class: 'toast' }, [
        h('span', {}, 'ENTRY DELETED'),
        h('button', {
          class: 'toast-undo',
          onClick: () => {
            vibrate(15);
            store.restoreEntry(removedEntry);
            dismissToast();
            build();
          }
        }, 'UNDO')
      ]);
      root.querySelector('.view')?.appendChild(toast);
      toastTimer = setTimeout(dismissToast, 5000);
    }

    function handleDelete(entry) {
      const removed = store.deleteEntry(entry.id);
      if (removed) {
        vibrate(15);
        build();
        showUndoToast(removed);
      }
    }

    function attachLongPress(cardEl, entry) {
      const start = () => {
        pressMoved = false;
        pressTimer = setTimeout(() => {
          if (!pressMoved) handleDelete(entry);
        }, LONG_PRESS_MS);
      };
      const cancel = () => { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; } };
      cardEl.addEventListener('pointerdown', start);
      cardEl.addEventListener('pointerup', cancel);
      cardEl.addEventListener('pointerleave', cancel);
      cardEl.addEventListener('pointercancel', cancel);
      cardEl.addEventListener('pointermove', () => { pressMoved = true; cancel(); });
    }

    function build() {
      const all = store.entriesSorted(); // newest first
      let running = 0;
      const balanceAfterById = new Map();
      [...all].reverse().forEach(e => { running += e.deltaSec; balanceAfterById.set(e.id, running); });

      const visible = filter === 'all' ? all : all.filter(e => e.type === filter);

      let earnedTotal = 0, spentTotal = 0;
      for (const e of visible) {
        if (e.type === 'earn') earnedTotal += e.deltaSec;
        else spentTotal += e.deltaSec;
      }
      const netTotal = earnedTotal + spentTotal;

      const filterRow = h('div', { class: 'filter-row' }, [
        h('button', {
          class: 'filter-btn' + (filter === 'all' ? ' active' : ''), 'data-filter': 'all',
          onClick: () => { vibrate(15); filter = 'all'; build(); }
        }, 'ALL'),
        h('button', {
          class: 'filter-btn' + (filter === 'earn' ? ' active' : ''), 'data-filter': 'earn',
          onClick: () => { vibrate(15); filter = 'earn'; build(); }
        }, 'EARNED'),
        h('button', {
          class: 'filter-btn' + (filter === 'spend' ? ' active' : ''), 'data-filter': 'spend',
          onClick: () => { vibrate(15); filter = 'spend'; build(); }
        }, 'SPENT')
      ]);

      const summary = h('div', { class: 'summary-strip' }, [
        h('span', {}, `EARNED +${fmtHM(earnedTotal)}`),
        h('span', {}, `SPENT ${fmtHM(spentTotal)}`),
        h('span', {}, `NET ${netTotal >= 0 ? '+' : ''}${fmtHM(netTotal)}`)
      ]);

      const hint = h('div', {
        style: { font: '400 9px \'JetBrains Mono\', monospace', letterSpacing: '.1em', color: 'var(--fg-28)', textAlign: 'center', marginTop: '10px' }
      }, 'HOLD AN ENTRY TO DELETE');

      // group by day
      const groups = [];
      let currentLabel = null;
      let currentGroup = null;
      for (const e of visible) {
        const label = dayLabel(e.endedAt);
        if (label !== currentLabel) {
          currentLabel = label;
          currentGroup = { label, entries: [] };
          groups.push(currentGroup);
        }
        currentGroup.entries.push(e);
      }

      const listChildren = [];
      if (groups.length === 0) {
        listChildren.push(emptyCard());
      } else {
        for (const g of groups) {
          listChildren.push(h('div', { class: 'day-header' }, [
            h('span', { class: 'day-header-label' }, g.label),
            h('span', { class: 'divider-line' })
          ]));
          const listWrap = h('div', { class: 'entry-list' },
            g.entries.map(e => {
              const card = entryCard(e, { balanceAfterSec: balanceAfterById.get(e.id) });
              attachLongPress(card, e);
              return card;
            }));
          listChildren.push(listWrap);
        }
      }

      const headerRight = h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } }, [
        chip('EXPORT', null, () => { vibrate(15); exportData(); }),
        chip('IMPORT', null, () => { vibrate(15); fileInput.click(); }),
        chip(`${all.length} TOTAL`)
      ]);

      const fileInput = h('input', {
        class: 'io-file-input', type: 'file', accept: 'application/json',
        onChange: async (e) => {
          const file = e.target.files && e.target.files[0];
          e.target.value = '';
          if (!file) return;
          try {
            const text = await file.text();
            const parsed = JSON.parse(text);
            if (!validateImport(parsed)) { alert('That file doesn\'t look like a Time Currency backup.'); return; }
            if (!confirm(`Replace the current ledger (${store.getState().entries.length} entries) with the imported one (${parsed.entries.length} entries)?`)) return;
            store.replaceAll(parsed);
            build();
          } catch {
            alert('Could not read that file.');
          }
        }
      });

      const view = h('div', { class: 'view' }, [
        h('div', { class: 'view-scroll' }, [
          h('div', { class: 'view-header' }, [
            h('div', { class: 'screen-title' }, 'LOG / HISTORY'),
            headerRight
          ]),
          fileInput,
          filterRow,
          hint,
          summary,
          ...listChildren
        ])
      ]);

      root.replaceChildren(view);
    }

    build();

    return () => {
      // Unmounting means navigation is already happening elsewhere (nav
      // rail tap, etc) — just tear down the toast UI, don't fight it with
      // our own history.back().
      clearToastUI();
    };
  }
};
