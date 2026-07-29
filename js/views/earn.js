// Earn / log focus. PLAN.md §6.2 — from earn-3a.html, with ÷4/÷6 (§3.2)
// replacing the design's ×1.5/×1.00, and uppercase H/M (§3.1) via fmtHM.
import { store } from '../store.js';
import { fmtHM, clock, hhmm, creditSecFor, newId, DIVISOR } from '../format.js';
import { h, divider, entryCard, emptyCard, vibrate, chip } from '../ui.js';
import { updateSeg } from '../seg.js';
import * as sw from '../stopwatch.js';

export default {
  mount(root) {
    const draft = store.getState().draft.earn;
    let typingManual = false;
    let tickTimer = null;
    let refs = {};

    function workedSec() {
      return draft.mode === 'stopwatch' ? sw.elapsedSec(draft) : draft.manualMin * 60;
    }

    function persist() {
      store.updateDraft('earn', draft);
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
      const worked = workedSec();
      const credit = creditSecFor(draft.category, worked);
      if (refs.segBox) updateSeg(refs.segBox, clock(worked), '#c9f97a', 26);
      if (refs.inputVal) refs.inputVal.textContent = fmtHM(worked);
      if (refs.outVal) refs.outVal.textContent = '+' + fmtHM(credit);
      if (refs.ctaBtn) refs.ctaBtn.textContent = `CREDIT +${fmtHM(credit)}`;
    }

    function flash(el) {
      if (!el) return;
      el.style.transition = 'none';
      el.style.color = '#c9f97a';
      requestAnimationFrame(() => {
        el.style.transition = 'color .6s';
        el.style.color = '';
      });
    }

    function build() {
      refs = {};
      const worked = workedSec();
      const credit = creditSecFor(draft.category, worked);
      const balance = store.balanceSec();
      const todayEarns = store.todayEntries('earn');
      const totalFocusSec = todayEarns.reduce((n, e) => n + e.workedSec, 0);
      const creditedSec = todayEarns.reduce((n, e) => n + e.deltaSec, 0);
      const streak = store.earnStreak();
      const canCommit = worked > 0;

      const bankedChip = chip(`BANKED ${fmtHM(balance)}`);
      refs.bankedChip = bankedChip;

      // ---- mode toggle ----
      const modeRow = h('div', { class: 'segmented' }, [
        h('button', {
          class: 'seg-btn' + (draft.mode === 'stopwatch' ? ' active accent-lime' : ''),
          onClick: () => { vibrate(15); draft.mode = 'stopwatch'; persist(); build(); }
        }, 'STOPWATCH'),
        h('button', {
          class: 'seg-btn' + (draft.mode === 'manual' ? ' active accent-lime' : ''),
          onClick: () => { vibrate(15); draft.mode = 'manual'; persist(); build(); }
        }, 'MANUAL')
      ]);

      // ---- stopwatch / manual panel ----
      let ioPanel;
      if (draft.mode === 'stopwatch') {
        const segBox = h('div', { class: 'seg-housing-inner' });
        refs.segBox = segBox;
        const recDot = h('span', { class: 'rec-dot' + (draft.running ? ' running' : '') });
        recDot.style.background = draft.running ? '#a8e85f' : 'rgba(220,248,232,.25)';

        ioPanel = h('div', { class: 'io-panel' }, [
          h('div', { class: 'io-panel-head' }, [
            h('span', { class: 'panel-label' }, 'ELAPSED · HH:MM:SS'),
            h('span', { class: 'rec-dot-row' }, [recDot, draft.running ? 'RECORDING' : 'ARMED'])
          ]),
          h('div', { class: 'seg-housing' }, [segBox]),
          h('div', { class: 'btn-row' }, [
            h('button', {
              class: 'btn btn--lime btn--notch-a btn-row--flex2',
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
        updateSeg(segBox, clock(worked), '#c9f97a', 26);
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

        ioPanel = h('div', { class: 'io-panel' }, [
          h('div', { class: 'panel-label' }, 'MANUAL DURATION · MINUTES'),
          h('div', { class: 'stepper-row' }, [
            h('button', {
              class: 'stepper-btn stepper-btn--minus',
              onClick: () => { vibrate(15); draft.manualMin = Math.max(0, draft.manualMin - 5); persist(); build(); }
            }, '−'),
            readout,
            h('button', {
              class: 'stepper-btn stepper-btn--plus-lime',
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
          updateSeg(segHost, hhmm(draft.manualMin), '#c9f97a', 24);
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

      // ---- category tiles ----
      const catRow = h('div', { class: 'tile-grid-2' }, [
        h('button', {
          class: 'tile' + (draft.category === 'schoolwork' ? ' active' : ''),
          onClick: () => { vibrate(15); draft.category = 'schoolwork'; persist(); build(); }
        }, [
          h('div', { class: 'tile-name' }, 'SCHOOLWORK'),
          h('div', { class: 'tile-rate' }, `÷ ${DIVISOR.schoolwork}`)
        ]),
        h('button', {
          class: 'tile' + (draft.category === 'personal' ? ' active' : ''),
          onClick: () => { vibrate(15); draft.category = 'personal'; persist(); build(); }
        }, [
          h('div', { class: 'tile-name' }, 'PERSONAL'),
          h('div', { class: 'tile-rate' }, `÷ ${DIVISOR.personal}`)
        ])
      ]);

      // ---- conversion strip ----
      const inputVal = h('div', { class: 'convert-value' }, fmtHM(worked));
      const outVal = h('div', { class: 'convert-value convert-value--glow' }, '+' + fmtHM(credit));
      refs.inputVal = inputVal;
      refs.outVal = outVal;
      const convertStrip = h('div', { class: 'convert-strip' }, [
        h('div', {}, [h('div', { class: 'panel-label' }, 'FOCUS INPUT'), inputVal]),
        h('div', { class: 'convert-arrow' }, `÷ ${DIVISOR[draft.category]} →`),
        h('div', { class: 'convert-out' }, [h('div', { class: 'panel-label panel-label--accent' }, 'FEED TIME EARNED'), outVal])
      ]);

      // ---- logged today ----
      const loggedDivider = divider('LOGGED TODAY', streak > 0 ? `STREAK ${streak}D` : null);
      const loggedList = h('div', { class: 'entry-list' },
        todayEarns.length ? todayEarns.slice(0, 5).map(e => entryCard(e, { compact: true })) : [emptyCard('NOTHING LOGGED YET')]);
      const summary = h('div', { class: 'summary-strip' }, [
        h('span', {}, `TOTAL FOCUS ${fmtHM(totalFocusSec)}`),
        h('span', {}, `CREDITED ${fmtHM(creditedSec)}`)
      ]);

      // ---- CTA ----
      const ctaBtn = h('button', {
        class: 'btn btn--lime btn--notch-a cta-lime' + (canCommit ? '' : ' cta-disabled'),
        onClick: () => {
          if (!canCommit) return;
          vibrate(25);
          const now = Date.now();
          const entry = {
            id: newId(),
            type: 'earn',
            category: draft.category,
            app: null,
            workedSec: worked,
            deltaSec: credit,
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
        }
      }, `CREDIT +${fmtHM(credit)}`);
      refs.ctaBtn = ctaBtn;

      const view = h('div', { class: 'view' }, [
        h('div', { class: 'view-scroll' }, [
          h('div', { class: 'view-header' }, [
            h('div', { class: 'screen-title' }, 'EARN / LOG FOCUS'),
            bankedChip
          ]),
          modeRow,
          ioPanel,
          divider('CATEGORY'),
          catRow,
          convertStrip,
          loggedDivider,
          loggedList,
          summary
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
