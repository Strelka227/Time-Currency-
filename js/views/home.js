// Home / dashboard. PLAN.md §6.1 — from home-2d.html, minus the progress
// bar and daily cap (§3.3), plus the negative/debt treatment (§1.2).
import { store } from '../store.js';
import { fmtHM, fmtLongMinutes } from '../format.js';
import { h, divider, entryCard, emptyCard, vibrate, chip } from '../ui.js';
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
      const recent = store.entriesSorted().slice(0, 3);
      const todayEarn = sumToday('earn');
      const todaySpend = sumToday('spend');

      clockChipEl = chip(nowLabel());

      const headerRight = [];
      if (installPrompt.available) {
        headerRight.push(chip('INSTALL', 'orange', () => {
          vibrate(15);
          installPrompt.request();
        }));
      }
      headerRight.push(clockChipEl);

      const view = h('div', { class: 'view' }, [
        h('div', { class: 'view-scroll' }, [
          h('div', { class: 'view-header' }, [
            h('div', { class: 'screen-title' }, 'LEDGER / HOME'),
            h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } }, headerRight)
          ]),

          h('div', { class: 'panel-glass' + (negative ? ' panel-glass--danger' : '') }, [
            h('div', { class: 'panel-row' }, [
              h('div', { class: 'panel-label' + (negative ? ' panel-label--accent-danger' : '') }, 'SPENDABLE TIME'),
              h('div', { class: 'panel-label' + (negative ? ' panel-label--accent-danger' : ' panel-label--accent') },
                negative ? 'IN DEBT' : 'FEED UNLOCK')
            ]),
            h('div', { class: 'hero-number hero-number--long' + (negative ? ' hero-number--danger' : '') },
              fmtLongMinutes(balanceSec))
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
