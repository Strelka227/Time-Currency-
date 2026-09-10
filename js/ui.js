// Small shared DOM-building & formatting helpers used by every view.
import { fmtHM, timeLabel, DIVISOR, spendDivisorFor } from './format.js';
import { conditionAt, applyLampVars } from './conditions.js';
import { store } from './store.js';

// Tiny hyperscript-ish element builder. No vdom — every view does a full
// rebuild on state change, which is cheap at this app's scale (§8).
export function h(tag, attrs, children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v);
  }
  for (const c of [].concat(children || [])) {
    if (c == null || c === false) continue;
    el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export const REDUCED_MOTION = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function vibrate(ms) {
  try {
    if (navigator.vibrate && !REDUCED_MOTION()) navigator.vibrate(ms);
  } catch { /* not supported */ }
}

export const CATEGORY_LABEL = { schoolwork: 'SCHOOLWORK', personal: 'PERSONAL' };
export const APP_LABEL = { TIKTOK: 'TIKTOK', INSTAGRAM: 'INSTAGRAM', AUXILIARY: 'AUX', YOUTUBE: 'YOUTUBE' };

function signedDelta(sec) {
  return sec >= 0 ? '+' + fmtHM(sec) : fmtHM(sec);
}

// One entry-card shape reused across Home, Earn, Spend and History.
export function entryCard(entry, opts) {
  opts = opts || {};
  const isEarn = entry.type === 'earn';
  // Spend rows name the unlock duration too, not just the cost — on a
  // discounted app those differ, and "YOUTUBE · 15M UNLOCKED ... −5M" is
  // the only way the row explains itself.
  const title = isEarn
    ? `${CATEGORY_LABEL[entry.category]} · ${fmtHM(entry.workedSec)} FOCUS`
    : `${APP_LABEL[entry.app] || entry.app} · ${fmtHM(entry.workedSec)} UNLOCKED`;

  const rate = isEarn
    ? `÷ ${DIVISOR[entry.category]}`
    : (spendDivisorFor(entry.app) === 1 ? 'SPENT' : `÷ ${spendDivisorFor(entry.app)}`);
  const sub = entry.source === 'stopwatch' && entry.startedAt
    ? `${timeLabel(entry.startedAt)} → ${timeLabel(entry.endedAt)} · ${rate}`
    : `${timeLabel(entry.endedAt)} · ${rate}`;

  const mainChildren = [
    h('div', { class: 'entry-title' }, title),
    h('div', { class: 'entry-sub' }, sub)
  ];

  const rightChildren = [
    h('div', { class: 'entry-delta' + (isEarn ? '' : ' entry-delta--spend') }, signedDelta(entry.deltaSec))
  ];
  if (opts.balanceAfterSec != null) {
    rightChildren.push(
      h('div', { class: 'entry-balance-after' + (opts.balanceAfterSec < 0 ? ' entry-balance-after--danger' : '') },
        fmtHM(opts.balanceAfterSec))
    );
  }

  return h('div', {
    class: 'entry-card' + (isEarn ? '' : ' entry-card--spend') + (opts.compact ? ' entry-card--compact' : ''),
    'data-id': entry.id
  }, [
    h('div', { class: 'entry-main' }, mainChildren),
    h('div', {}, rightChildren)
  ]);
}

export function emptyCard(label) {
  return h('div', { class: 'entry-card entry-card--empty' }, label || 'NO ENTRIES YET');
}

export function divider(label, tail) {
  const children = [
    h('span', { class: 'divider-label' }, label),
    h('span', { class: 'divider-line' })
  ];
  if (tail) children.push(h('span', { class: 'divider-tail' }, tail));
  return h('div', { class: 'divider' }, children);
}

export function chip(text, variant, onClick) {
  const cls = 'chip' + (variant ? ` chip--${variant}` : '');
  return onClick
    ? h('button', { class: cls + ' chip-btn', onClick }, text)
    : h('div', { class: cls }, text);
}

// The condition indicator lamp that sits in the Home / Earn / Spend
// headers (design 4a, and the updated 3a/3b). Reads current condition
// from the store at call time, so every header stays in sync.
export function conditionLamp() {
  const cond = conditionAt(store.conditionIndex());
  const lamp = applyLampVars(h('span', { class: 'cond-lamp-sm', title: `Condition: ${cond.name}` }), cond);
  return lamp;
}
