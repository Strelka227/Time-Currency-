// Condition — set the condition, read its description. Design 4b.
//
// Selecting a condition only records it (see conditions.js): nothing here
// restricts spending or gates app selection.
import { store } from '../store.js';
import { CONDITIONS, conditionAt, applyLampVars } from '../conditions.js';
import { h, divider, vibrate } from '../ui.js';

export default {
  mount(root) {
    function build() {
      const idx = store.conditionIndex();
      const cond = conditionAt(idx);

      // ---- header ----
      const headerLamp = applyLampVars(h('span', { class: 'cond-lamp-sm' }), cond);

      // ---- current condition summary ----
      const bigLamp = applyLampVars(h('div', { class: 'cond-lamp-big' }), cond);
      const currentPanel = h('div', { class: 'cond-panel' }, [
        h('div', { class: 'cond-current-row' }, [
          h('div', { class: 'cond-lamp-housing cond-current-lamp' }, [bigLamp]),
          h('div', { style: { flex: '1', minWidth: '0' } }, [
            h('div', { class: 'cond-current-name' }, cond.name),
            applyLampVars(h('div', { class: 'cond-current-status' }, 'ACTIVE'), cond)
          ])
        ]),
        h('div', { class: 'cond-current-desc' }, cond.desc),
        cond.note ? h('div', { class: 'cond-current-note' }, cond.note) : null
      ]);

      // ---- selectable rows ----
      const rows = CONDITIONS.map((c, i) => {
        const active = i === idx;
        const row = h('button', {
          class: 'cond-row' + (active ? ' active' : ''),
          'aria-pressed': active ? 'true' : 'false',
          onClick: () => {
            if (i === store.conditionIndex()) return;
            vibrate(15);
            // setCondition notifies, and this view is subscribed — no
            // explicit rebuild needed here.
            store.setCondition(i);
          }
        }, [
          h('div', { class: 'cond-row-lamp' }),
          h('div', { class: 'cond-row-body' }, [
            h('div', { class: 'cond-row-head' }, [
              h('span', { class: 'cond-row-name' }, c.name),
              h('span', { class: 'cond-row-status' }, active ? 'ACTIVE' : 'SET')
            ]),
            h('div', { class: 'cond-row-desc' }, c.desc),
            c.note ? h('div', { class: 'cond-row-note' }, c.note) : null
          ])
        ]);
        return applyLampVars(row, c);
      });

      const view = h('div', { class: 'view' }, [
        h('div', { class: 'view-scroll' }, [
          h('div', { class: 'view-header' }, [
            h('div', { class: 'screen-title' }, 'SYSTEM / CONDITION'),
            headerLamp
          ]),
          currentPanel,
          divider('SET CONDITION'),
          h('div', { class: 'cond-list' }, rows),
          h('div', { class: 'cond-footnote' }, 'RECORD OF WHICH RULE SET IS BEING FOLLOWED.')
        ])
      ]);

      root.replaceChildren(view);
    }

    build();
    const unsub = store.subscribe(build);
    return () => unsub();
  }
};
