// Seven-segment SVG digit renderer. Ported from the design bundle's
// React seg() (design-reference/dc-logic.js.txt) to plain DOM/SVG.
// Geometry is tuned — do not change the polygon points.

const SVGNS = 'http://www.w3.org/2000/svg';

const SEGMENT_POINTS = {
  a: '16,3 44,3 50,9 44,15 16,15 10,9',
  b: '51,10 57,16 57,42 51,48 45,42 45,16',
  c: '51,52 57,58 57,84 51,90 45,84 45,58',
  d: '16,85 44,85 50,91 44,97 16,97 10,91',
  e: '9,52 15,58 15,84 9,90 3,84 3,58',
  f: '9,10 15,16 15,42 9,48 3,42 3,16',
  g: '16,44 44,44 50,50 44,56 16,56 10,50'
};

const DIGIT_MAP = {
  '0': 'abcdef', '1': 'bc', '2': 'abdeg', '3': 'abcdg', '4': 'bcfg',
  '5': 'acdfg', '6': 'acdefg', '7': 'abc', '8': 'abcdefg', '9': 'abcdfg'
};

function digitSvg(ch, color, dw) {
  const h = dw * (100 / 60);
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('viewBox', '0 0 60 100');
  svg.setAttribute('width', String(dw));
  svg.setAttribute('height', String(h));
  svg.style.display = 'block';
  svg.style.overflow = 'visible';
  const on = DIGIT_MAP[ch] || '';
  for (const k of Object.keys(SEGMENT_POINTS)) {
    const poly = document.createElementNS(SVGNS, 'polygon');
    poly.setAttribute('points', SEGMENT_POINTS[k]);
    const lit = on.indexOf(k) >= 0;
    poly.setAttribute('fill', lit ? color : 'rgba(255,255,255,.055)');
    if (lit) poly.style.filter = `drop-shadow(0 0 ${dw * 0.2}px ${color})`;
    svg.appendChild(poly);
  }
  return svg;
}

function colonEl(color, dw) {
  const h = dw * (100 / 60);
  const col = document.createElement('div');
  col.style.cssText =
    `width:${dw * 0.3}px;height:${h}px;display:flex;flex-direction:column;` +
    `justify-content:center;gap:${h * 0.16}px;align-items:center`;
  for (let i = 0; i < 2; i++) {
    const dot = document.createElement('div');
    dot.style.cssText =
      `width:${dw * 0.17}px;height:${dw * 0.19}px;background:${color};` +
      `box-shadow:0 0 ${dw * 0.28}px ${color}`;
    col.appendChild(dot);
  }
  return col;
}

// Renders `text` (digits + optional ':') as seven-segment glyphs.
// Returns a detached <div> — caller inserts it, and may call renderSeg
// again to replace it wholesale (cheap: a handful of small SVGs).
export function renderSeg(text, color, dw) {
  const wrap = document.createElement('div');
  wrap.style.cssText = `display:flex;align-items:center;justify-content:center;gap:${dw * 0.14}px`;
  for (const ch of String(text)) {
    wrap.appendChild(ch === ':' ? colonEl(color, dw) : digitSvg(ch, color, dw));
  }
  return wrap;
}

// Replace `container`'s contents with a fresh render — avoids the caller
// having to manage the wrapper node itself.
export function updateSeg(container, text, color, dw) {
  container.replaceChildren(renderSeg(text, color, dw));
}
