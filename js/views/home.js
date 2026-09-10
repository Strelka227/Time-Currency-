// Home / dashboard. PLAN.md §6.1 — from home-2d.html, minus the progress
// bar and daily cap (§3.3), plus the negative/debt treatment (§1.2).
import { store } from '../store.js';
import { fmtHM, fmtLongParts } from '../format.js';
import { h, divider, entryCard, emptyCard, vibrate, chip, conditionLamp } from '../ui.js';
import { conditionAt, applyLampVars } from '../conditions.js';
import { installPrompt } from '../pwa.js';

function nowLabel() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `LOCAL ${hh}:${mm}`;
}

function sumToday(type) {
  return store.todayEntries(type).reduce((n, e) => n + e.deltaSec, 0);
}

export default {
  mount(root) {
    let clockChipEl = null;
    let clockTimer = null;

    function build() {
      const balanceSec = store.balanceSec();
      const negative = balanceSec < 0;
      const parts = fmtLongParts(balanceSec);
      const recent = store.entriesSorted().slice(0, 3);
      const todayEarn = sumToday('earn');
      const todaySpend = sumToday('spend');

      clockChipEl = chip(nowLabel());

      // Lamp + INSTALL + clock together overflow the 268px header at Pixel
      // widths. The INSTALL chip is transient and only appears until the app
      // is installed, and Android already shows the time in its own status
      // bar right above, so the clock yields to it for that short window.
      const headerRight = [conditionLamp()];
      if (installPrompt.available) {
        headerRight.push(chip('INSTALL', 'orange', () => {
          vibrate(15);
          installPrompt.request();
        }));
      } else {
        headerRight.push(clockChipEl);
      }

      // ---- current condition (design 4a) ----
      const cond = conditionAt(store.conditionIndex());
      const condPanel = h('div', { class: 'cond-panel' }, [
        h('div', { class: 'panel-label' }, 'CURRENT CONDITION'),
        h('div', { class: 'cond-lamp-housing', style: { marginTop: '10px' } }, [
          applyLampVars(
            h('div', { class: 'cond-lamp-big' }, [
              h('span', { class: 'cond-lamp-label' }, cond.name)
            ]),
            cond
          )
        ]),
        h('div', { class: 'cond-desc' }, cond.desc),
        cond.note ? h('div', { class: 'cond-note' }, cond.note) : null
      ]);
      // The lamp label sits on the lamp itself, so its colour follows the
      // lamp's brightness rather than the app's text palette.
      condPanel.style.setProperty('--cond-label', cond.labelColor);

      const view = h('div', { class: 'view' }, [
        h('div', { class: 'view-scroll' }, [
          h('div', { class: 'view-header' }, [
            h('div', { class: 'screen-title' }, 'LEDGER / HOME'),
            h('div', { class: 'header-group' }, headerRight)
          ]),

          condPanel,
          h('div', { class: 'panel-glass' + (negative ? ' panel-glass--danger' : '') }, [
            h('div', { class: 'panel-row' }, [
              h('div', { class: 'panel-label' + (negative ? ' panel-label--accent-danger' : '') }, 'SPENDABLE TIME'),
              h('div', { class: 'panel-label' + (negative ? ' panel-label--accent-danger' : ' panel-label--accent') },
                negative ? 'IN DEBT' : 'FEED UNLOCK')
            ]),
            h('div', { class: 'hero-stack' + (negative ? ' hero-stack--danger' : '') }, [
              // Sign rides on whichever row comes first, so a debt reads
              // "−2 Hours / 30 Minutes" rather than losing the minus.
              parts.hours ? h('div', { class: 'hero-line' }, parts.sign + parts.hours) : null,
              parts.minutes ? h('div', { class: 'hero-line' }, (parts.hours ? '' : parts.sign) + parts.minutes) : null
            ])
          ]),

          h('div', { class: 'stat-strip' }, [
            h('div', { class: 'stat-cell' }, [
              h('div', { class: 'stat-cell-label', style: { color: '#a8e85f' } }, 'EARNED · TODAY'),
              h('div', { class: 'stat-cell-value' }, '+' + fmtHM(todayEarn))
            ]),
            h('div', { class: 'stat-cell' }, [
              h('div', { class: 'stat-cell-label', style: { color: '#ffab4d' } }, 'SPENT · TODAY'),
              h('div', { class: 'stat-cell-value' }, fmtHM(todaySpend))
            ])
          ]),

          divider('RECENT'),
          h('div', { class: 'entry-list' },
            recent.length ? recent.map(e => entryCard(e)) : [emptyCard()])
        ]),

        h('div', { class: 'view-cta' }, [
          h('button', {
            class: 'btn btn--lime btn--notch-a cta-lime',
            style: { flex: '2' },
            onClick: () => { vibrate(15); location.hash = '#/earn'; }
          }, 'LOG FOCUS'),
          h('button', {
            class: 'btn btn--orange btn--notch-b cta-orange',
            style: { flex: '1' },
            onClick: () => { vibrate(15); location.hash = '#/spend'; }
          }, 'SPEND')
        ])
      ]);

      root.replaceChildren(view);
    }

    build();
    const unsubStore = store.subscribe(build);
    const unsubInstall = installPrompt.subscribe(build);
    clockTimer = setInterval(() => {
      if (clockChipEl) clockChipEl.textContent = nowLabel();
    }, 30000);

    return () => {
      unsubStore();
      unsubInstall();
      clearInterval(clockTimer);
    };
  }
};
