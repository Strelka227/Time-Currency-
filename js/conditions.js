// The condition system — design bundle turn 4 (4a/4b).
//
// This is a RECORD of which rule set is currently being followed, not an
// enforcement mechanism. Nothing here gates app selection or spending:
// the design's own footer calls it "record of which rule set is being
// followed", and it lists greying out restricted apps as a future idea
// rather than something it does. That also matches the app's existing
// honor-system stance (PLAN.md §4) — a PWA cannot actually block TikTok.

export const CONDITIONS = [
  {
    name: 'CONDITION 0', tone: 'WHITE', color: '#ffffff', rgb: '255,255,255',
    labelColor: 'rgba(10,20,14,.82)',
    desc: 'All restrictions disabled',
    note: ''
  },
  {
    name: 'CONDITION 1', tone: 'YELLOW', color: '#ffd93d', rgb: '255,217,61',
    labelColor: 'rgba(10,20,14,.82)',
    desc: 'Restrictions: TikTok, Instagram',
    note: 'Read Your Bible!'
  },
  {
    name: 'CONDITION 2', tone: 'ORANGE', color: '#ff9d2e', rgb: '255,157,46',
    labelColor: 'rgba(10,20,14,.82)',
    desc: 'Restrictions: TikTok, Instagram, Auxiliary Content',
    note: 'Read Your Bible!'
  },
  {
    name: 'CONDITION 3', tone: 'LIGHT RED', color: '#ff6b6b', rgb: '255,107,107',
    labelColor: 'rgba(10,20,14,.82)',
    desc: 'Restrictions: TikTok, Instagram, Auxiliary Content, YouTube',
    note: ''
  },
  {
    // Dark enough that the lamp label has to flip to light text.
    name: 'CONDITION 4', tone: 'DARK RED', color: '#a01f2a', rgb: '160,31,42',
    labelColor: '#ffe8ea',
    desc: 'Restrictions: TikTok, Instagram, Auxiliary Content, YouTube, Video Games',
    note: ''
  }
];

export const DEFAULT_CONDITION = 3;
export const NOTE_COLOR = '#ff3b30';

export function clampCondition(i) {
  return Number.isInteger(i) && i >= 0 && i < CONDITIONS.length ? i : DEFAULT_CONDITION;
}

export function conditionAt(i) {
  return CONDITIONS[clampCondition(i)];
}

// Every lamp is driven by these two custom properties, so the colour
// lives in one place and CSS does the rest of the glow/bezel work.
export function applyLampVars(el, cond) {
  el.style.setProperty('--cond-color', cond.color);
  el.style.setProperty('--cond-rgb', cond.rgb);
  return el;
}
