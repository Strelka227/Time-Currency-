// Spend / unlock. PLAN.md §6.3 — from spend-3b.html. Overdraft is allowed
// (§1.2): the CTA never blocks, it just warns via the danger palette and
// shows the projected balance before committing.
import { store } from '../store.js';
import { fmtHM, clock, hhmm, newId } from '../format.js';
import { h, divider, entryCard, emptyCard, vibrate, chip } from '../ui.js';
import { updateSeg } from '../seg.js';
import * as sw from '../stopwatch.js';

const APPS = [
  { id: 'TIKTOK', label: 'TIKTOK' },
  { id: 'INSTAGRAM', label: 'INSTAGRAM' },
  { id: 'AUXILIARY', label: 'AUX' }
];

export default {
  mount(root) {
    const draft = store.getState().draft.spend;
    let typingManual = false;
    let tickTimer = null;
    let refs = {};

    function spentSec() {
      return draft.mode === 'stopwatch' ? sw.elapsedSec(draft) : draft.manualMin * 60;
    }

    function persist() {
      store.updateDraft('spend', draft);
    }

    function updateTicking() {
      const shouldTick = draft.mode === 'stopwatch' && draft.running;
      if (shouldTick && !tickTimer) {
        tickTimer = setInterval(tick, 250);
        sw.acquireWakeLock();
      } else if (!shouldTick && tickTimer) {
        clearInterval(tickTimer);
        tickTimer = null;
        sw.releaseWakeLock();
      }
    }

    function tick() {
      const spent = spentSec();
      if (refs.segBox) updateSeg(refs.segBox, clock(spent), '#ffc478', 26);
      if (refs.spendCell) refs.spendCell.textContent = '−' + fmtHM(spent);
      const remain = store.balanceSec() - spent;
      if (refs.remainCell) {
        refs.remainCell.textContent = fmtHM(remain);
        refs.remainCell.className = 'preview-value' + (remain < 0 ? ' preview-value--danger' : '');
      }
      if (refs.ctaBtn) refreshCta(refs.ctaBtn, spent, remain);
    }

    function refreshCta(btn, spent, remain) {
      const danger = remain < 0;
      btn.className = 'btn ' + (danger ? 'btn--danger cta-danger' : 'btn--orange cta-orange') + (spent > 0 ? '' : ' cta-disabled');
      btn.textContent = danger
        ? `UNLOCK ${fmtHM(spent)} → ${fmtHM(remain)}`
        : `UNLOCK ${fmtHM(spent)}`;
    }

    function flash(el) {
      if (!el) return;
      el.style.transition = 'none';
      el.style.color = '#ffc478';
      requestAnimationFrame(() => {
        el.style.transition = 'color .6s';
        el.style.color = '';
      });
    }

    function build() {
      refs = {};
      const spent = spentSec();
      const balance = store.balanceSec();
      const remain = balance - spent;
      const todaySpends = store.entriesSorted().filter(e => e.type === 'spend').slice(0, 5);
      const canCommit = spent > 0;

      const bankedChip = chip(`BANKED ${fmtHM(balance)}`, 'orange');
      refs.bankedChip = bankedChip;

      // ---- mode toggle ----
      const modeRow = h('div', { class: 'segmented' }, [
        h('button', {
          class: 'seg-btn' + (draft.mode === 'stopwatch' ? ' active accent-orange' : ''),
          onClick: () => { vibrate(15); draft.mode = 'stopwatch'; persist(); build(); }
        }, 'STOPWATCH'),
        h('button', {
          class: 'seg-btn' + (draft.mode === 'manual' ? ' active accent-orange' : ''),
          onClick: () => { vibrate(15); draft.mode = 'manual'; persist(); build(); }
        }, 'MANUAL')
      ]);

      // ---- app select ----
      const appRow = h('div', { class: 'app-select' },
        APPS.map(a => h('button', {
          class: 'app-btn' + (draft.app === a.id ? ' active' : ''),
          onClick: () => { vibrate(15); draft.app = a.id; persist(); build(); }
        }, a.label))
      );

      // ---- stopwatch / manual panel ----
      let ioPanel;
      if (draft.mode === 'stopwatch') {
        const segBox = h('div', { class: 'seg-housing-inner' });
        refs.segBox = segBox;
        const recDot = h('span', { class: 'rec-dot' + (draft.running ? ' running' : '') });
        recDot.style.background = draft.running ? '#ffab4d' : 'rgba(220,248,232,.25)';

        ioPanel = h('div', { class: 'io-panel io-panel--orange' }, [
          h('div', { class: 'io-panel-head' }, [
            h('span', { class: 'panel-label' }, 'SESSION · HH:MM:SS'),
            h('span', { class: 'rec-dot-row' }, [recDot, draft.running ? 'SESSION LIVE' : 'ARMED'])
          ]),
          h('div', { class: 'seg-housing' }, [segBox]),
          h('div', { class: 'btn-row' }, [
            h('button', {
              class: 'btn btn--orange btn--notch-a btn-row--flex2',
              style: { flex: '2' },
              onClick: () => {
                vibrate(15);
                if (draft.running) { sw.stop(draft); }
                else {
                  if (draft.accumulatedSec === 0 && !draft.sessionStartedAt) draft.sessionStartedAt = Date.now();
                  sw.start(draft);
                }
                persist();
                updateTicking();
                build();
              }
            }, draft.running ? 'STOP' : 'START'),
            h('button', {
              class: 'btn btn--neutral',
              onClick: () => {
                vibrate(15);
                sw.reset(draft);
                draft.sessionStartedAt = null;
                persist();
                updateTicking();
                build();
              }
            }, 'RESET')
          ])
        ]);
        updateSeg(segBox, clock(spent), '#ffc478', 26);
      } else {
        const manualBody = typingManual
          ? h('input', {
              class: 'stepper-input',
              type: 'number', inputmode: 'numeric', min: '0', step: '5',
              value: String(draft.manualMin),
              onBlur: (e) => commitManualInput(e.target.value),
              onKeydown: (e) => { if (e.key === 'Enter') e.target.blur(); }
            })
          : h('div', { class: 'seg-housing-inner' });

        const readout = h('div', { class: 'stepper-readout' }, [
          h('div', { class: 'seg-housing', onClick: () => { if (!typingManual) { typingManual = true; build(); } } }, [
            manualBody,
            h('div', { class: 'seg-sub' }, 'HH : MM')
          ])
        ]);

        ioPanel = h('div', { class: 'io-panel io-panel--orange' }, [
          h('div', { class: 'panel-label' }, 'UNLOCK DURATION · MINUTES'),
          h('div', { class: 'stepper-row' }, [
            h('button', {
              class: 'stepper-btn stepper-btn--minus',
              onClick: () => { vibrate(15); draft.manualMin = Math.max(0, draft.manualMin - 5); persist(); build(); }
            }, '−'),
            readout,
            h('button', {
              class: 'stepper-btn stepper-btn--plus-orange',
              onClick: () => { vibrate(15); draft.manualMin = draft.manualMin + 5; persist(); build(); }
            }, '+')
          ]),
          h('div', { class: 'stepper-foot' }, [
            h('span', {}, 'STEP 5 MIN'),
            h('span', {}, 'TAP READOUT TO TYPE')
          ])
        ]);

        if (!typingManual) {
          const segHost = ioPanel.querySelector('.seg-housing-inner');
          updateSeg(segHost, hhmm(draft.manualMin), '#ffc478', 24);
        } else {
          requestAnimationFrame(() => ioPanel.querySelector('.stepper-input')?.focus());
        }
      }

      function commitManualInput(raw) {
        const n = Math.max(0, Math.round(Number(raw) || 0));
        draft.manualMin = n;
        typingManual = false;
        persist();
        build();
      }

      // ---- balance preview ----
      const spendCell = h('div', { class: 'preview-value' }, '−' + fmtHM(spent));
      const remainCell = h('div', { class: 'preview-value' + (remain < 0 ? ' preview-value--danger' : '') }, fmtHM(remain));
      refs.spendCell = spendCell;
      refs.remainCell = remainCell;
      const preview = h('div', { class: 'tile-grid-3' }, [
        h('div', { class: 'preview-cell' }, [h('div', { class: 'preview-label', style: { color: 'var(--fg-42)' } }, 'BANKED'), h('div', { class: 'preview-value' }, fmtHM(balance))]),
        h('div', { class: 'preview-cell' }, [h('div', { class: 'preview-label', style: { color: 'var(--orange)' } }, 'SPEND'), spendCell]),
        h('div', { class: 'preview-cell' }, [h('div', { class: 'preview-label', style: { color: 'var(--mint)' } }, 'REMAINING'), remainCell])
      ]);

      // ---- recent unlocks ----
      const recentList = h('div', { class: 'entry-list' },
        todaySpends.length ? todaySpends.map(e => entryCard(e, { compact: true })) : [emptyCard('NO UNLOCKS YET')]);

      // ---- CTA ----
      const ctaBtn = h('button', { class: 'btn' }, '');
      refs.ctaBtn = ctaBtn;
      refreshCta(ctaBtn, spent, remain);
      ctaBtn.addEventListener('click', () => {
        if (spentSec() <= 0) return;
        vibrate(25);
        const worked = spentSec();
        const now = Date.now();
        const entry = {
          id: newId(),
          type: 'spend',
          category: null,
          app: draft.app,
          workedSec: worked,
          deltaSec: -worked,
          startedAt: draft.mode === 'stopwatch' ? draft.sessionStartedAt : null,
          endedAt: now,
          source: draft.mode === 'stopwatch' ? 'stopwatch' : 'manual'
        };
        store.addEntry(entry);
        sw.reset(draft);
        draft.sessionStartedAt = null;
        draft.manualMin = 0;
        persist();
        updateTicking();
        build();
        flash(refs.bankedChip);
      });

      const view = h('div', { class: 'view' }, [
        h('div', { class: 'view-scroll' }, [
          h('div', { class: 'view-header' }, [
            h('div', { class: 'screen-title' }, 'SPEND / UNLOCK'),
            bankedChip
          ]),
          modeRow,
          appRow,
          ioPanel,
          divider('BALANCE PREVIEW'),
          preview,
          divider('RECENT UNLOCKS'),
          recentList
        ]),
        h('div', { class: 'view-cta' }, [ctaBtn])
      ]);

      root.replaceChildren(view);
    }

    function onVisible() {
      if (document.visibilityState === 'visible') tick();
    }

    build();
    updateTicking();
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      if (tickTimer) clearInterval(tickTimer);
      sw.releaseWakeLock();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }
};
