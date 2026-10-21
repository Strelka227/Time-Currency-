# Time Currency — Build Plan

**For:** a Claude Code instance implementing the app from scratch.
**Target:** installable PWA on a **Google Pixel — Android, Chrome**. Not iOS. See §4.
**Status:** spec complete. No code written yet. Everything below is decided — build it, don't re-design it.

---

## 0. What this app is

A personal, single-user "time currency" ledger that makes opening TikTok/Instagram cost something.

- You **earn** currency by logging focused work time.
- You **spend** currency to unlock time on distracting apps.
- The balance **can go negative** — spending past zero puts you in debt, which is allowed and visible, not blocked (§1.2).
- Balance and history persist locally. No accounts, no backend, no network calls.
- Runs as an installable PWA on the owner's Pixel (add to home screen, works offline).

**One unit only: minutes.** The balance is a number of minutes of unlocked feed time. Do not introduce a second unit ("TC", "credits", points). The design prototype had a `TC → minutes` conversion at 3.4 TC/min — that concept is **deleted**.

---

## 1. The math (authoritative — the design bundle is wrong here)

Earning is a **divide**, not a multiply.

| Category | Rule | Divisor |
|---|---|---|
| Schoolwork | currency earned (min) = time worked (min) ÷ 4 | 4 |
| Personal project | currency earned (min) = time worked (min) ÷ 6 | 6 |

Spending is **1:1** — spending 20 minutes on TikTok debits 20 minutes.

Worked examples that must hold exactly:

- 40 min schoolwork → **+10 min** balance
- 120 min schoolwork → **+30 min**
- 60 min personal → **+10 min**
- 45 min personal → 2700s ÷ 6 = **450s**, displayed as **7M** (the leftover 30s stays banked — see the rounding rule)
- 20 min spent on TikTok → **−20 min**
- Balance 4 min, spend 9 min → balance becomes **−5 min** (see §1.2)

### 1.1 Rounding rule (implement exactly)

Store everything internally as **integer seconds**. Never store fractional minutes; never accumulate floats.

```js
const DIVISOR = { schoolwork: 4, personal: 6 };

// earning
creditSec = Math.round(workedSec / DIVISOR[category]);
// spending
debitSec  = spentSec;
```

Display uses a **signed floor** to whole minutes — one rule, both directions:

```js
const MINUS = '−';                    // U+2212, matches the design's glyph

function fmtHM(sec) {                      // 9000 -> "2H 30M", 450 -> "7M", -330 -> "−6M"
  const m = Math.floor(sec / 60);          // signed floor: 330 -> 5, -330 -> -6
  const a = Math.abs(m);
  const body = a >= 60
    ? `${Math.floor(a / 60)}H ${String(a % 60).padStart(2, '0')}M`
    : `${a}M`;
  return (m < 0 ? MINUS : '') + body;
}
```

`Math.floor` on the **signed** value is deliberate and is the whole trick: it rounds a positive balance down (never claim time you don't have) and a negative balance away from zero (never understate a debt). Do not "fix" it to `Math.trunc` or to flooring the absolute value.

Check: 40 min schoolwork = 2400s ÷ 4 = 600s → `fmtHM` → `10M`. ✅

### 1.2 Negative balances are allowed and are a first-class state

The balance **may go below zero**. Spending 9 minutes against a 4-minute balance leaves you at `−5M`, and that is a legitimate state the app must display and carry forward, not an error to block.

- Nothing anywhere clamps the balance at 0. In particular `fmtHM` must not clamp — see above.
- A negative balance renders in `--danger` (`#ff6b5c`) with the `−` prefix, everywhere it appears.
- Earning digs you back out normally: at `−5M`, banking 40 min of schoolwork (`+10M`) puts you at `+5M`.
- There is **no** `INSUFFICIENT BALANCE` blocked state and no `ALLOW_OVERDRAFT` flag. Every commit succeeds.
- The Spend screen still *warns* before you go under (§6.3) — it just never refuses.

The live "what you'll earn" preview on the Earn screen and the value actually committed must call the **same** functions, so the preview never disagrees with the result.

---

## 2. Design source

The visuals come from the Claude Design bundle
`Time Currency - Dashboard Directions.dc.html`
(project `e3bf3d96-2396-47cf-9380-289e42942af5`).

**Only these iterations are in scope. Ignore every other variant in the bundle (1a/1b/1c, 2a/2b/2c) — they were earlier exploration.**

| Screen | Iteration | Extracted reference |
|---|---|---|
| Home / dashboard | **2d** (dark green) | `design-reference/home-2d.html` |
| Earn / time entry | **3a** | `design-reference/earn-3a.html` |
| Spend | **3b** | `design-reference/spend-3b.html` |
| History / log | *not designed* | derive from the three above — see §6.4 |

Supporting extracts:
- `design-reference/dc-logic.js.txt` — the prototype's state + the **seven-segment SVG digit renderer** (port this, it's the signature element)
- `design-reference/dc-head-styles.html` — font links and the `tcpulse` keyframe

### Reading the reference files

They are Claude Design template markup, not runnable code:

- `{{ expr }}` — interpolation resolved by the DC runtime → replace with real DOM updates
- `<sc-if value="{{ x }}">` — conditional block → replace with show/hide
- `style-active="…"` — a DC-only pseudo-state attribute → port to a real CSS `:active` rule
- `React.createElement(...)` in `dc-logic.js.txt` → port to plain DOM / SVG strings

**Do not ship `support.js`** (the DC runtime) or React. It is a 70 KB canvas harness with no place in the app.

---

## 3. The three required changes to the design

### 3.1 Uppercase H / M everywhere

Every duration display uses **`H`** and **`M`**, never `h`/`m`.

Places in the reference markup that currently read lowercase and must be changed:

- Home 2d: big balance readout (`2h 04m` → `2H 04M`), `EARNED · TODAY +2h 15m`, `SPENT · TODAY −48m`, every recent-entry amount (`+2h 15m`, `−20m`, `+45m`), and the entry subtitles (`SCHOOLWORK · 90m FOCUS` → `· 90M FOCUS`)
- Earn 3a: the `BANKED …` chip, `FOCUS INPUT` value, `FEED TIME EARNED` value, the `CREDIT +…` button label, the `LOGGED TODAY` rows, and the `TOTAL FOCUS … / CREDITED …` strip
- Spend 3b: the `BANKED …` chip, the `BANKED / SPEND / REMAINING` preview trio, the `UNLOCK …` button label, and the `RECENT UNLOCKS` rows

Practically: this is one function. Make `fmtHM()` (§1) the **only** place durations are formatted, and every one of the above is fixed at once. Grep the finished app for `` `h ` `` / `'m'` string literals in duration contexts to confirm nothing bypasses it.

The `ELAPSED · HH:MM:SS`, `SESSION · HH:MM:SS` and `HH : MM` labels are already uppercase — leave them.

### 3.2 Correct the conversion math

The design shows `×1.50` on the SCHOOLWORK tile and `×1.00` on PERSONAL, and a `×{{ earnRate }} →` arrow in the conversion strip. All of that is wrong.

- SCHOOLWORK tile subtitle: `×1.50` → **`÷ 4`**
- PERSONAL tile subtitle: `×1.00` → **`÷ 6`**
- Conversion strip arrow: `×{{ earnRate }} →` → **`÷ 4 →`** / **`÷ 6 →`** (follows the selected category)
- Entry rows that read `· ×1.50` / `· ×1.00` in their timestamp line → `· ÷ 4` / `· ÷ 6`
- The Home screen's `1.50 TC / MIN` style rate table (in the discarded 1x iterations) does not exist in 2d — nothing to do there.

### 3.3 Remove the progress bar and daily limit from Home 2d

Inside the big `SPENDABLE TIME` card, delete:

1. The **8-segment progress bar** — the `<div style="display:flex;gap:3px;margin-top:16px;height:6px">` row with its eight `<span>` children.
2. The **`DAILY CAP 4h 00m`** label in the footer row beneath it.

Keep the footer row itself and its top border; it now holds only `{{ n }} MIN BANKED` on the left. Either let it span full width or keep it left-aligned — left-aligned reads better. Tighten the card's vertical rhythm so removing ~22px doesn't leave a hole.

There is **no daily cap concept anywhere in the app.** Do not add one back in the History screen, settings, or anywhere else.

---

## 4. Target device & tech decisions (already made — don't relitigate)

**Target: Google Pixel, Android, Chrome.** This is a single-device app for one person's phone. Build and test against Chrome on Android. Desktop Chrome at a 390×844 device-emulation viewport is the development proxy.

There is **no iOS/Safari requirement** — do not spend effort on `-webkit-` fallbacks, Safari quirks, `apple-*` meta tags, or the iOS "add to home screen" flow. Everything below assumes an evergreen Chromium engine, which unlocks a few things Safari would have blocked (see §10.4).

| Decision | Choice | Why |
|---|---|---|
| Framework | **None. Vanilla JS + DOM.** | Zero build step, instant load, trivially cacheable offline. The whole app is ~4 screens and one number. |
| Build tooling | **None.** Static files served as-is. | Nothing to break, nothing to reinstall in six months. |
| Routing | Hash routes (`#/home`, `#/earn`, `#/spend`, `#/log`) with show/hide of four `<section>`s | The Android back gesture walks hash history for free — see §10.5. |
| Styling | One `styles.css` with CSS custom properties for the palette | The reference markup is all inline styles — lift them into classes as you port. |
| Storage | `localStorage`, single JSON key, plus `navigator.storage.persist()` | Sync API, a few KB of data. Persist matters on Android — see §8.1. |
| Offline | Service worker, cache-first app shell | Required for "works offline", and required for Chrome to treat the app as installable at all. |
| Fonts | **Self-hosted woff2** in `fonts/`, precached | Google Fonts CDN will not load offline. This is the #1 thing that silently breaks PWAs. |
| CSS baseline | Target Chrome/Android only | `backdrop-filter`, `clip-path`, `dvh`, `env()` and nested CSS all ship unprefixed. Keep `-webkit-backdrop-filter` only if it costs nothing. |

**Explicitly out of scope:** accounts, auth, sync, any backend, any analytics, notifications, iOS support, app-blocking/enforcement (Android gives a PWA no way to actually block TikTok — this is an honor-system ledger), a daily cap.

---

## 5. File layout

```
time-currency/
  PLAN.md                    <- this file
  design-reference/          <- read-only extracts from the design bundle
    home-2d.html
    earn-3a.html
    spend-3b.html
    dc-logic.js.txt
    dc-head-styles.html
  app/                       <- everything below is what you build & deploy
    index.html
    styles.css
    js/
      store.js               <- state, persistence, migrations
      format.js              <- fmtHM, clock(), date helpers
      seg.js                 <- seven-segment SVG digit renderer
      stopwatch.js           <- clock-derived stopwatch
      views/
        home.js
        earn.js
        spend.js
        log.js
      app.js                 <- boot, routing, nav rail
    manifest.webmanifest
    sw.js
    icons/
      icon-192.png
      icon-512.png
      icon-512-maskable.png     <- content inside the center 80% circle, see §10.6
      icon.svg
    fonts/
      barlow-{400,500,600}.woff2
      jetbrains-mono-{400,500,600}.woff2
      roboto-{300,400,500}.woff2
```

Single-file (everything inlined in `index.html`) is also acceptable and arguably better for a 4-screen offline app — but if you go that way, still keep the module boundaries as clearly-commented sections. **Pick one and be consistent.**

---

## 6. Screens

All four share the 2d chrome:

- **390×844 portrait phone canvas**, but built **fluid** — the design is a fixed-size mockup; the real app must fill the viewport at any phone size. Pixel widths run ~360–412 CSS px, so this is close but never exact. Use `100dvh`, flexbox, and `env(safe-area-inset-*)`.
- **Delete the fake status bar** (the `09:41 / 5G / battery` row at the top of every reference screen). Android draws the real one. In `display: standalone` Chrome tints it with the manifest's `theme_color`, so setting that to `#0a1a13` makes the system bar blend into the top of the gradient — which is exactly why deleting the mockup bar looks intentional rather than missing. Add `padding-top: env(safe-area-inset-top)` anyway; it costs nothing and covers the Pixel's punch-hole camera in landscape and any future display mode.
- **56px left nav rail**, dark glass, four glyphs top-to-bottom:
  diamond → Home · square → Earn · triangle → Spend · three-bar → History.
  Active glyph is filled in the screen's accent color with a glow; inactive is a 1.5px outline at `rgba(220,248,232,.32)`. `V 1.4` runs vertically at the bottom — replace with the real app version string.
- Background: the layered gradient + scanline overlay + two blurred radial glow blobs. Exact values in §7.

### 6.1 Home — from `home-2d.html`

Top to bottom:

1. Header row: `LEDGER / HOME` (mono, tracked) on the left; the right-hand chip currently reads `SYNCED 09:38` — **there is no sync**, so replace it with the live local time (e.g. `LOCAL 09:38`) or today's date. Keep the `#a8e85f` lime treatment.
2. **Big balance card** (glass panel, notched bottom-right corner):
   - `SPENDABLE TIME` label left, `FEED UNLOCK` label right
   - 66px / weight 300 Roboto readout: current balance via `fmtHM()`
   - *(progress bar removed — §3.3)*
   - footer row above a hairline top border: `<n> MIN BANKED` where `n` is the balance floored to whole minutes *(daily cap removed — §3.3)*
   - **Negative state** (§1.2): the hero readout switches to `--danger` `#ff6b5c` and reads `−5M`; the card's border and panel tint shift to the danger hue (`rgba(255,107,92,.30)` / `linear-gradient(150deg, rgba(255,107,92,.14), rgba(255,107,92,.04))`); the right-hand label changes `FEED UNLOCK` → `IN DEBT`; the footer reads `<n> MIN OWED`. Nothing is disabled — it's a mood change, not a lockout. Getting back to positive restores the mint treatment.
3. **Two-up today strip**: `EARNED · TODAY` (`#a8e85f`) and `SPENT · TODAY` (`#ffab4d`), both computed from today's entries, `+`/`−` prefixed.
4. `RECENT` divider, then the **3 most recent entries** as cards. Earn entries get a `#a8e85f` left border, spend entries `#ffab4d`. Title line = `SCHOOLWORK · 90M FOCUS` / `TIKTOK · UNLOCKED`; sub-line = `08:10 → 09:40 · ÷ 4` for earns, `07:44 → 08:04 · SPENT` for spends; right side = the signed delta.
   Empty state: a single muted `NO ENTRIES YET` card.
5. **Bottom action pair**, pinned above the safe-area inset: `LOG FOCUS` (flex 2, lime, notched top-left/bottom-right) → `#/earn`; `SPEND` (flex 1, orange, mirrored notch) → `#/spend`.

### 6.2 Earn — from `earn-3a.html`

1. Header: `EARN / LOG FOCUS` + `BANKED <fmtHM(balance)>` chip (mint outline).
2. `STOPWATCH | MANUAL` segmented pair. Selected = filled lime; unselected = dim.
3. **Stopwatch panel** (when STOPWATCH):
   - `ELAPSED · HH:MM:SS` label + status dot: `#a8e85f` pulsing + `RECORDING` when running, `rgba(220,248,232,.25)` + `ARMED` when stopped
   - seven-segment `HH:MM:SS` readout in `#c9f97a`, digit width 26 (§7.4)
   - `START`/`STOP` (flex 2, lime) + `RESET` (flex 1, neutral)
4. **Manual panel** (when MANUAL):
   - `MANUAL DURATION · MINUTES`
   - `−` / seg `HH:MM` readout / `+`, step 5 minutes, floor 0
   - readout is **tappable to type an exact number** (the design promises `TAP READOUT TO TYPE` — honor it: swap in a numeric input, `inputmode="numeric"`, commit on blur/Enter)
   - footer: `STEP 5 MIN` · `TAP READOUT TO TYPE`
5. `CATEGORY` divider, then a 2-up: **SCHOOLWORK `÷ 4`** and **PERSONAL `÷ 6`** (§3.2). Selected tile is filled lime.
6. **Conversion strip**: `FOCUS INPUT <fmtHM(worked)>` — `÷ 4 →` — `FEED TIME EARNED +<fmtHM(credit)>` (the right value glows, `#c9f97a` with `text-shadow: 0 0 14px rgba(168,232,95,.5)`). Recomputes live as the stopwatch runs and as the category changes.
7. `LOGGED TODAY` divider with a `STREAK <n>D` chip on the right — **compute it for real**: the number of consecutive days ending today that contain ≥1 earn entry. Hide the chip at 0.
8. Today's earn entries (same card style as Home), then a summary strip: `TOTAL FOCUS <fmtHM(today worked)>` · `CREDITED <fmtHM(today credited)>`.
9. Pinned bottom CTA: **`CREDIT +<fmtHM(credit)>`**. Disabled/dimmed when the pending amount is 0. On commit: append the entry, add to balance, reset the stopwatch/manual input to 0, and show brief confirmation (a flash on the balance chip is enough — no modal).

### 6.3 Spend — from `spend-3b.html`

Same skeleton, orange accent (`#ffab4d` / `#ffc478` / text `#fff6ec`), bottom-right glow blob is orange.

1. Header: `SPEND / UNLOCK` + `BANKED <fmtHM(balance)>` chip (orange outline).
2. `STOPWATCH | MANUAL` toggle (orange when selected).
3. **App select**, 3-up: `TIKTOK` · `INSTAGRAM` · `AUX`. Selected = filled orange. `AUX` is the catch-all — persist its label as `AUXILIARY` in the log (the prototype had a bug here: the button set `spendApp: 'AUXILIARY'` while the highlight checked `'YOUTUBE'`, so AUX never lit up. **Fix it** — use one constant per app).
4. Stopwatch / manual panels, orange variants. Spend stopwatch is 1:1 — no conversion strip.
5. `BALANCE PREVIEW` divider, then a 3-up: `BANKED` / `SPEND −<n>` / `REMAINING`. `REMAINING` turns `#ff6b5c` when the projected result is negative — that part of the design is right, keep it.
6. `RECENT UNLOCKS` divider + today's/most-recent spend entries.
7. Pinned bottom CTA: **always live, always commits** (§1.2). The design's dimmed `INSUFFICIENT BALANCE` state is **deleted**.
   - projected balance ≥ 0 → orange CTA, label `UNLOCK <fmtHM(spend)>`
   - projected balance < 0 → the same button switches to the **danger palette** (`#ff6b5c` border, `linear-gradient(180deg, rgba(255,107,92,.28), rgba(255,107,92,.08))`, `0 5px 0 rgba(104,26,20,.90)`) and the label becomes `UNLOCK <spend> → <fmtHM(projected)>`, e.g. **`UNLOCK 9M → −5M`**. Still fully enabled, still commits on tap.

   The warning is informational: it tells you the price before you pay it, then gets out of the way. Do not add a confirmation dialog, a long-press requirement, or any other friction — the color change and the projected number are the whole mechanism.

### 6.4 History / log — not designed; build it in the same language

Requirements: **every** entry, earned and spent, with timestamps.

- Header: `LOG / HISTORY` + a chip showing the total entry count.
- Filter row reusing the segmented-button style from Earn/Spend: `ALL` / `EARNED` / `SPENT`. `ALL` is neutral mint, `EARNED` lime, `SPENT` orange.
- Entries grouped under sticky day headers (`TODAY`, `YESTERDAY`, then `MON 14 JUL` style — mono, tracked, with the hairline divider treatment used by `RECENT`).
- Each row uses the existing entry-card component: colored left border, title, mono sub-line with the real timestamp, signed delta on the right. Add the **running balance after that entry** as a small muted mono value under the delta — this is the thing the small "recent" lists on the other screens can't show, and it's what makes the history screen worth having. Render that running balance in `--danger` for any point where it was negative, so a debt period is visible at a glance as a red streak down the list.
- A summary strip pinned under the filter row: `EARNED <total>` · `SPENT <total>` · `NET <total>` for the current filter. `NET` uses `fmtHM`'s signed output and can be negative.
- Long-press or swipe on a row → **delete entry** with an undo toast. Deleting recomputes the balance from the ledger (see §8 — balance is derived, so this is free). Use `navigator.vibrate(15)` on the long-press trigger (§10.4).
- Empty state matching Home's.
- No pagination needed at this scale; if the list exceeds ~500 entries, virtualize by rendering only the visible window.

---

## 7. Design tokens (lift these verbatim)

### 7.1 Color

```css
:root {
  /* surfaces */
  --bg-grad:      linear-gradient(160deg, #0a1a13 0%, #050b08 45%, #08140e 100%);
  --scanline:     repeating-linear-gradient(0deg, rgba(160,255,200,.045) 0 1px, transparent 1px 5px);
  --rail-bg:      rgba(0,0,0,.35);
  --panel-glass:  linear-gradient(150deg, rgba(110,231,168,.16), rgba(110,231,168,.04));
  --panel-flat:   rgba(160,255,200,.06);
  --card:         rgba(160,255,200,.055);
  --readout-bg:   rgba(0,0,0,.5);

  /* borders */
  --bd-strong:    rgba(160,255,200,.30);
  --bd:           rgba(160,255,200,.18);
  --bd-soft:      rgba(160,255,200,.14);

  /* accents */
  --mint:         #6ee7a8;   /* balance / earn secondary */
  --lime:         #a8e85f;   /* earn primary */
  --lime-glow:    #c9f97a;   /* earn readouts */
  --orange:       #ffab4d;   /* spend primary */
  --orange-soft:  #ffc478;   /* spend readouts */
  --danger:       #ff6b5c;   /* negative balance / debt — see §1.2 */
  --danger-bd:    rgba(255,107,92,.30);
  --danger-panel: linear-gradient(150deg, rgba(255,107,92,.14), rgba(255,107,92,.04));

  /* text */
  --fg:           #f0fff6;
  --fg-warm:      #fff6ec;   /* on orange screens */
  --fg-70:        rgba(220,248,232,.70);
  --fg-50:        rgba(220,248,232,.50);
  --fg-42:        rgba(220,248,232,.42);
  --fg-28:        rgba(220,248,232,.28);
}
```

Glow blobs (absolutely positioned, `filter: blur(14px)`):
- top-left, 420×420, `left:-140px; top:-120px`, `radial-gradient(circle, rgba(40,200,130,.18), transparent 68%)` (use `.20` on Earn, `.16` on Spend)
- bottom-right, 300×300, `right:-120px; bottom:-60px`, `radial-gradient(circle, rgba(190,255,120,.1), transparent 70%)` — on the Spend screen swap to 320×320 `rgba(255,171,77,.16)`

### 7.2 Type

Three families, self-hosted:

- **Barlow** 400/500/600 — UI labels, entry titles
- **JetBrains Mono** 400/500/600 — all-caps tracked micro-labels, timestamps, button text
- **Roboto** 300/400/500 — numeric readouts (300 at 66px for the hero balance)

Recurring specs straight from the markup:

| Role | Spec |
|---|---|
| Screen title | `600 11px 'JetBrains Mono'; letter-spacing:.24em; color: var(--fg-50)` |
| Micro label | `500 9px 'JetBrains Mono'; letter-spacing:.20em; color: var(--fg-50)` |
| Section divider label | `500 9px 'JetBrains Mono'; letter-spacing:.20em; color: var(--fg-42)` + `flex:1; height:1px; background: var(--bd)` rule |
| Hero number | `300 66px/0.85 Roboto; letter-spacing:-.04em; color: var(--fg)` |
| Panel number | `400 18–22px Roboto; color: var(--fg)` |
| Entry title | `500 11.5–12px Barlow; letter-spacing:.06em; color: var(--fg)` |
| Entry sub-line | `400 9.5–10px 'JetBrains Mono'; color: var(--fg-42)` |
| Button | `600 12.5px 'JetBrains Mono'; letter-spacing:.14–.16em` |

### 7.3 Shapes & effects

**Notched corners** via `clip-path` — this is the app's core visual signature. Two mirrored variants:

```css
/* top-left + bottom-right notch (leading / "primary" element) */
clip-path: polygon(11px 0, 100% 0, 100% calc(100% - 11px), calc(100% - 11px) 100%, 0 100%, 0 11px);
/* top-right + bottom-left notch (trailing / "secondary" element) */
clip-path: polygon(0 0, calc(100% - 11px) 0, 100% 11px, 100% 100%, 11px 100%, 0 calc(100% - 11px));
/* single bottom-right notch (panels & cards) */
clip-path: polygon(0 0, 100% 0, 100% calc(100% - 18px), calc(100% - 18px) 100%, 0 100%);
```

Notch radius scales with the element: 8px on small chips, 10–12px on buttons, 14px on strips, 18px on large panels.

**Glass panels:** `backdrop-filter: blur(18px)` (12px on flat strips, 10px on cards). Unprefixed is fine on Chrome/Android; keep `-webkit-backdrop-filter` alongside it only because it's free.

Perf note for the Pixel: `backdrop-filter` on many stacked elements plus two blurred radial glows is the one thing here that can cost frames. Promote the two glow blobs to their own layer (`will-change: transform`) and keep them **static** — never animate or re-render them. If the stopwatch screen ever drops frames while the segment display ticks, the glows are the first suspect, not the SVG.

**Chunky hardware buttons** — the signature interaction. Lime example:

```css
.btn-primary {
  background: linear-gradient(180deg, rgba(168,232,95,.30), rgba(168,232,95,.09));
  border: 1px solid #a8e85f;
  border-top-color: rgba(255,255,255,.70);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.32), 0 4px 0 rgba(50,84,10,.90);
}
.btn-primary:active {                       /* was style-active="" in the DC markup */
  box-shadow: inset 0 1px 0 rgba(255,255,255,.20), 0 1px 0 rgba(50,84,10,.90);
  transform: translateY(3px);
}
```

Orange variant uses `rgba(255,171,77,…)` with `0 4px 0 rgba(104,60,10,.90)`. Neutral variant uses `rgba(160,255,200,.09→.02)` with `0 4px 0 rgba(0,0,0,.55)`. Danger variant (§6.3) uses `rgba(255,107,92,…)` with `0 5px 0 rgba(104,26,20,.90)`. The pinned bottom CTAs go one step heavier: `0 5px 0 …` plus an outer `0 0 26px rgba(accent,.16)` glow, and `translateY(4px)` on press.

Add `touch-action: manipulation` and `-webkit-tap-highlight-color: transparent` globally (Chrome Android draws that grey tap flash by default and it ruins the hardware-button illusion), and make every tap target ≥48px tall — Android's Material minimum, slightly above the design's 44px. The reference buttons are already ≥44px; nudge the short ones up.

Pair the `:active` press with `navigator.vibrate(15)` on commit-level buttons (§10.4) — a 15ms tick sells the physical-switch metaphor better than any amount of CSS.

**Pulse dot:**

```css
@keyframes tcpulse { 0%,100% { opacity:.35 } 50% { opacity:1 } }
```

Respect `@media (prefers-reduced-motion: reduce)` — drop the pulse and the button translate.

### 7.4 Seven-segment readout

This is the app's hero component. `dc-logic.js.txt` has the working implementation (`seg()` / `clock()`); port it to plain SVG. Keep the polygon geometry **exactly** — it's tuned.

- viewBox `0 0 60 100` per digit; rendered at `width = dw`, `height = dw * (100/60)`
- lit segments: `fill: <color>` + `filter: drop-shadow(0 0 ${dw*0.2}px ${color})`
- unlit segments: `fill: rgba(255,255,255,.055)` — **always draw them**, the ghost segments are what sells the effect
- colon: two squares, `dw*0.17` wide × `dw*0.19` tall, in a `dw*0.3`-wide column, `gap: h*0.16`
- digit gap: `dw * 0.14`
- segment map: `0:abcdef 1:bc 2:abdeg 3:abcdg 4:bcfg 5:acdfg 6:acdefg 7:abc 8:abcdefg 9:abcdfg`
- polygon points (a=top, b=top-right, c=bottom-right, d=bottom, e=bottom-left, f=top-left, g=middle) — copy from `dc-logic.js.txt` lines for `const S = { … }`

Sizes: `dw = 26` for the `HH:MM:SS` stopwatch, `dw = 24` for the `HH:MM` manual entry.

Housing (both):

```css
background: rgba(0,0,0,.5);
border: 1px solid var(--bd);          /* orange variant on Spend */
box-shadow: inset 0 2px 10px rgba(0,0,0,.7);
```
plus an absolutely-positioned overlay at `z-index:2`, `pointer-events:none`:
`repeating-linear-gradient(0deg, rgba(0,0,0,.35) 0 1px, transparent 1px 3px)`

---

## 8. Data model & persistence

Single `localStorage` key: **`timecurrency.v1`**

```jsonc
{
  "version": 1,
  "entries": [
    {
      "id": "01J8…",              // sortable unique id (timestamp + random suffix is fine)
      "type": "earn",             // "earn" | "spend"
      "category": "schoolwork",   // earn: "schoolwork" | "personal"
      "app": null,                // spend: "TIKTOK" | "INSTAGRAM" | "AUXILIARY"
      "workedSec": 2400,          // raw duration entered (earn: focus time; spend: unlock time)
      "deltaSec": 600,            // signed effect on balance: +600 earn, -1200 spend
      "startedAt": 1753689000000, // epoch ms, null for manual entries
      "endedAt":   1753691400000, // epoch ms; = the entry timestamp
      "source": "stopwatch"       // "stopwatch" | "manual"
    }
  ],
  "draft": {                       // in-flight UI state, so closing the app loses nothing
    "earn":  { "mode":"stopwatch", "category":"schoolwork", "manualMin":45,
               "running":false, "startedAt":null, "accumulatedSec":0 },
    "spend": { "mode":"stopwatch", "app":"TIKTOK",          "manualMin":20,
               "running":false, "startedAt":null, "accumulatedSec":0 }
  }
}
```

**The balance is derived, never stored:**

```js
const balanceSec = entries.reduce((n, e) => n + e.deltaSec, 0);
```

This is the single most important structural decision. It makes deletion, undo, and any future edit trivially correct, and removes any chance of the balance drifting out of sync with the log. Memoize it if the list ever gets long; at a few thousand entries it's free.

Write-through: persist on every mutation (`JSON.stringify` the whole object — it's small). Wrap reads in try/catch and fall back to a fresh empty state if the JSON is corrupt or missing. Include the `version` field now so a future migration has something to switch on.

Also persist on `visibilitychange → hidden` and `pagehide`. Android Chrome **freezes and then discards** backgrounded PWAs under memory pressure, and a discarded page gets no further JS execution — if you only persist on `beforeunload`, you will lose writes.

### 8.1 Make the storage persistent (Android-specific, do not skip)

Chrome on Android puts `localStorage` in the **best-effort** storage bucket by default, which the OS may evict when the device is low on space. Losing the ledger makes the entire app pointless, so ask for durable storage at boot:

```js
if (navigator.storage?.persist) {
  const already = await navigator.storage.persisted();
  if (!already) await navigator.storage.persist();   // installed PWAs are auto-granted
}
```

Chrome grants this silently for installed PWAs — no permission prompt — so calling it costs nothing and closes the biggest data-loss hole.

### 8.2 Backup / restore

Because this is the only copy of the data and it lives on one phone, add a minimal escape hatch — a small `EXPORT` / `IMPORT` pair, reachable from the History screen header:

- **Export**: serialize the whole state object and hand it off. On Android Chrome prefer `navigator.share({ files: [new File([json], 'time-currency-backup.json', { type: 'application/json' })] })` so it can go straight to Drive/Keep/Gmail; fall back to a `Blob` + `<a download>` if the Web Share API rejects files.
- **Import**: `<input type="file" accept="application/json">`, validate `version` and that `entries` is an array of well-formed rows, then replace the state. Confirm before overwriting.

This is ~30 lines and it's the difference between "I lost a factory reset" and "I didn't".

---

## 9. Stopwatch — do not copy the prototype's approach

The design prototype ticks `setInterval(… secs + 1 …)`. **That is wrong on Android**: Chrome throttles background timers hard (down to roughly once per minute after a few minutes hidden), then **freezes** the page entirely, and may **discard** it under memory pressure. A counter-incrementing stopwatch will quietly under-report — you'd log 40 minutes of focus as 6, or worse, come back to a discarded page and lose the session outright.

Derive elapsed time from the wall clock instead:

```js
function elapsedSec(sw) {                     // sw = {running, startedAt, accumulatedSec}
  return sw.accumulatedSec +
    (sw.running ? Math.floor((Date.now() - sw.startedAt) / 1000) : 0);
}
function start(sw) { sw.running = true;  sw.startedAt = Date.now(); }
function stop(sw)  { sw.accumulatedSec = elapsedSec(sw); sw.running = false; sw.startedAt = null; }
function reset(sw) { sw.running = false; sw.startedAt = null; sw.accumulatedSec = 0; }
```

- Render with `setInterval(render, 250)` that **recomputes from the clock** — never increments a counter. Throttling then becomes irrelevant: a frozen page simply renders the correct total the moment it thaws.
- Persist the stopwatch state (in `draft`) on start/stop/reset. A running stopwatch survives the app being closed, frozen, or discarded, and keeps accruing — which is the correct behavior for both earning focus time and tracking a feed session.
- Re-render immediately on `visibilitychange` so the readout is correct the instant the app comes back.
- Earn and Spend each own an independent stopwatch; both can run at once without interfering.
- On commit, the entry's `startedAt`/`endedAt` come from the stopwatch so the log shows the true `08:10 → 09:40` window.
- **Wake lock (Android bonus):** while a stopwatch is running and its screen is visible, hold a `navigator.wakeLock.request('screen')` so the Pixel doesn't dim mid-session. Release it on stop and on `visibilitychange → hidden`, and re-acquire on return. Wrap in a feature check and a try/catch — it's a nicety, never a dependency.

---

## 10. PWA setup (Android / Chrome)

### 10.1 `manifest.webmanifest`

```jsonc
{
  "id": "/time-currency/",
  "name": "Time Currency",
  "short_name": "Currency",
  "description": "Earn feed time by logging focused work.",
  "start_url": "./index.html",
  "scope": "./",
  "display": "standalone",
  "display_override": ["standalone", "minimal-ui"],
  "orientation": "portrait",
  "background_color": "#050b08",
  "theme_color": "#0a1a13",
  "icons": [
    { "src": "icons/icon-192.png",          "sizes": "192x192", "type": "image/png" },
    { "src": "icons/icon-512.png",          "sizes": "512x512", "type": "image/png" },
    { "src": "icons/icon-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],
  "shortcuts": [
    { "name": "Log focus", "short_name": "Earn",  "url": "./index.html#/earn"  },
    { "name": "Spend",     "short_name": "Spend", "url": "./index.html#/spend" }
  ]
}
```

Android-specific notes on the above:

- **`theme_color` tints the system status bar** in standalone mode. `#0a1a13` is the top stop of the background gradient, so the status bar reads as part of the app rather than a black band. This is the single highest-leverage line in the manifest for making it feel native.
- **`shortcuts`** become long-press actions on the home-screen icon — jump straight to Earn or Spend without passing through Home. Android supports up to 4; two is right here.
- **`id`** pins the app's identity so a future change to `start_url` doesn't create a duplicate installed app. Set it once, never change it.
- **The 192 and 512 PNGs are mandatory** for Chrome to consider the app installable. An SVG-only icon set will silently fail the install criteria.
- `display: "fullscreen"` would hide the status bar entirely for a more immersive look — **don't**. It also hides the clock and battery, which is hostile in an app you open to check how much time you have.

### 10.2 `index.html` head

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0a1a13">
<meta name="color-scheme" content="dark">
<link rel="manifest" href="manifest.webmanifest">
```

That's the whole list — no `apple-*` tags, no `apple-touch-icon`. `color-scheme: dark` stops Chrome from flashing a white background during load and keeps form controls dark.

`viewport-fit=cover` plus `env(safe-area-inset-*)` handles the Pixel's gesture-navigation pill at the bottom. In portrait standalone the top inset is usually 0 (Chrome reserves the status bar itself), but honoring both insets costs nothing and keeps the pinned bottom CTAs clear of the gesture bar — which is the one place this actually bites.

### 10.3 `sw.js`

Cache-first app shell:

```js
const CACHE = 'tc-v1';                  // bump on every deploy
const ASSETS = [ './', './index.html', './styles.css', /* js, fonts, icons, manifest */ ];

self.addEventListener('install',  e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys()
  .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
  .then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
```

Register it from `app.js` guarded by `if ('serviceWorker' in navigator)`. There are no network resources at all once the fonts are self-hosted, so the app is fully functional offline from first load.

**A `fetch` handler is required for installability** — Chrome will not offer to install a PWA whose service worker has no fetch listener, even if everything else is in order. Don't "optimize" it away.

### 10.4 Android-only capabilities worth using

Chromium ships these and Safari does not, so they were off the table before and are on it now:

- **`navigator.vibrate(ms)`** — a 15ms tick on every hardware-style button press, and 25ms on a commit (`CREDIT` / `UNLOCK`). This is the cheapest possible upgrade to the design's physical-switch language. Gate it behind `prefers-reduced-motion` too.
- **`beforeinstallprompt`** — capture the event, `preventDefault()` it, stash it, and surface a small `INSTALL` chip in the Home header styled like the existing mono chips. Call `.prompt()` on tap. Without this you're relying on Chrome's easily-missed menu item.
- **`navigator.storage.persist()`** — §8.1. Protects the ledger from eviction.
- **`navigator.wakeLock`** — §9. Keeps the screen alive during a running stopwatch.
- **Web Share API with files** — §8.2. Makes backup export a one-tap send to Drive.

All five are progressive enhancements: feature-detect each one and carry on silently if it's missing.

### 10.5 Android back gesture

The system back gesture/button pops browser history. With hash routing that means:

- Navigating Home → Earn → Spend pushes two entries; back walks them in reverse. Correct by default, no work needed.
- **Use `location.hash = '#/earn'` for forward navigation** (pushes history) but **`history.replaceState` for the initial route normalization** on boot, so the very first back press doesn't land on an empty `#`.
- From Home with no history, back closes the app. That's the expected Android behavior — **do not** intercept it with a "press again to exit" or a confirm dialog.
- The History screen's delete-undo toast should be dismissed by back rather than letting back navigate away while a pending undo is on screen. This is the one place intercepting back is justified.

### 10.6 Icons

Author `icons/icon.svg` in the design language — a lime `#a8e85f` diamond (matching the Home nav glyph) on the `#0a1a13`→`#050b08` gradient. Rasterize to 192 and 512 PNG.

**Maskable is not optional on Android** — the Pixel launcher applies an adaptive-icon mask (circle, squircle, or whatever the theme uses) and crops anything outside it. For `icon-512-maskable.png`, keep all meaningful content inside the **center 80% circle** (a 512px icon needs its artwork within a ~410px centered circle) and let the gradient background bleed to all four edges. A diamond glyph at ~50% of the canvas satisfies this comfortably. Test it with Chrome DevTools → Application → Manifest, which previews the masked shapes.

If no image tooling is available, render the SVG onto a `<canvas>` in a throwaway HTML page and `toDataURL()` the PNGs out — don't add a build dependency for three icons.

### 10.7 Serving & on-device testing

Service workers require `https://` or `localhost` — **`file://` will not work**.

The fastest loop for testing on the actual Pixel, without deploying anything:

```bash
adb reverse tcp:8080 tcp:8080
```

With the phone on USB and a static server running (`npx serve app -l 8080`), `http://localhost:8080` on the Pixel now hits the dev machine — and because the phone sees it as `localhost`, the service worker registers and the app is fully installable. Pair it with `chrome://inspect` on the desktop for remote DevTools against the live phone.

For the permanent install, deploy to any static HTTPS host — GitHub Pages is the obvious one — and add to home screen from Chrome on the phone.

---

## 11. Build order

1. **Skeleton + tokens** — `index.html`, `styles.css` with §7 custom properties, the four empty `<section>`s, the nav rail, hash routing. Verify the background/scanline/glow chrome matches `home-2d.html` side by side in Chrome device emulation at 390×844.
2. **`format.js` + `store.js`** — `fmtHM` (signed, §1.1), `clock`, the divisor table, load/save, derived balance. Unit-check the §12 numbers in the console — **including the negative cases** — before building any UI on top.
3. **`seg.js`** — the seven-segment renderer, verified against the reference at `dw = 26` and `dw = 24`.
4. **Home** — static-data version first, then wire to the store. Apply the §3.3 removals as you build; don't build the progress bar and then delete it. Build the negative/debt treatment (§6.1) at the same time as the positive one, not as a later patch.
5. **`stopwatch.js`** — clock-derived, persisted. Test by backgrounding the app for several minutes and confirming the readout jumps to the true elapsed time.
6. **Earn** — mode toggle, category tiles with `÷ 4` / `÷ 6`, live conversion strip, commit.
7. **Spend** — app select (fix the AUX constant bug), balance preview, the danger-state CTA that still commits (§6.3), commit.
8. **History** — §6.4, plus export/import (§8.2).
9. **PWA** — fonts self-hosted, manifest, icons, service worker, `storage.persist()`. Then get it onto the Pixel via §10.7 and confirm: installs, launches standalone, works in airplane mode.
10. **Android polish** — vibration, install prompt, wake lock, back-gesture behavior (§10.4–10.5).
11. **Pass §12.**

Ship each step working before starting the next; there is no scaffolding that has to land all at once.

---

## 12. Acceptance checklist

Math:
- [ ] 40 min schoolwork → balance increases by exactly **10M**
- [ ] 120 min schoolwork → **+30M**; 60 min personal → **+10M**; 30 min personal → **+5M**
- [ ] Spending 20 min debits exactly **20M**
- [ ] The live preview on Earn always equals what the commit actually adds
- [ ] No `×1.5`, `×1.00`, `TC`, `3.4`, or "per min" rate appears anywhere in the shipped app

Negative balances (§1.2):
- [ ] From a **4M** balance, spending **9M** leaves the balance at **−5M** — the commit succeeds, nothing blocks it
- [ ] `fmtHM(-330)` returns `−6M`, `fmtHM(-3630)` returns `−1H 01M`, `fmtHM(0)` returns `0M`
- [ ] From **−5M**, banking 40 min of schoolwork lands on exactly **+5M**
- [ ] The negative balance renders in `#ff6b5c` with a `−` on Home, in both `BANKED` chips, and in the History running-balance column
- [ ] The Spend CTA shows the danger palette and the projected result (`UNLOCK 9M → −5M`) *before* the tap, and still commits
- [ ] The string `INSUFFICIENT BALANCE` does not appear anywhere in the shipped app

Design fixes:
- [ ] Every duration in the entire UI renders `H`/`M` uppercase — no lowercase `h`/`m` survives
- [ ] SCHOOLWORK tile reads `÷ 4`, PERSONAL reads `÷ 6`, conversion arrow follows the selection
- [ ] Home's `SPENDABLE TIME` card has **no** segmented progress bar and **no** `DAILY CAP` label, and the card's spacing looks intentional after removal
- [ ] No daily-limit concept exists anywhere in the app

Function:
- [ ] Balance and full history survive a force-quit and relaunch
- [ ] A running stopwatch survives backgrounding the app for 5+ minutes and reports the true elapsed time
- [ ] History shows every entry — earned and spent — with real timestamps, newest first, filterable
- [ ] Deleting a history entry corrects the balance
- [ ] Export produces a JSON file that Import restores exactly

PWA on the actual Pixel:
- [ ] Chrome offers to install it; the `INSTALL` chip works
- [ ] Launches standalone with no browser chrome, and the system status bar is tinted `#0a1a13` so it blends into the gradient
- [ ] Fully usable in airplane mode, including fonts and the segment readout
- [ ] The home-screen icon is not cropped by the launcher's adaptive-icon mask
- [ ] Long-pressing the icon offers the `Earn` / `Spend` shortcuts and they land on the right screen
- [ ] Pinned bottom CTAs sit clear of the gesture-navigation pill
- [ ] Back gesture walks Home ← Earn ← Spend and exits from Home without a confirm dialog
- [ ] `navigator.storage.persisted()` returns `true` after install
- [ ] Lighthouse "Installable" passes

Fidelity:
- [ ] Home, Earn and Spend are visually faithful to `home-2d.html`, `earn-3a.html`, `spend-3b.html` at 390×844 — notched corners, glass blur, hardware-button press states, glow, scanlines and the segment readout all present
- [ ] Layout holds from 360px to 412px wide (Pixel range), and on a tall/short viewport
- [ ] Scrolling and the ticking segment display hold 60fps on the Pixel

---

## 13. Open items (assumptions taken — flag to the owner, don't block on them)

Settled by the owner, not open:
- **Negative balances are allowed** and are a first-class state (§1.2). No block, no flag, no confirm dialog.
- **Target is Android / Pixel / Chrome only** (§4). No iOS work.

Still assumptions:

1. **`AUX` is the third spend target**, persisted as `AUXILIARY`. If the owner wants YouTube or a custom label, that's a one-line constant plus a rename.
2. **Rounding is `Math.round` on credit, signed floor on display.** 45 min personal banks 450s and displays `7M`; the residual 30s is retained and shows up once another entry pushes past the next whole minute.
3. **`STREAK` is consecutive days with ≥1 earn entry**, ending today.
4. **No editing of existing entries** — delete + re-add. Add editing later only if it's actually missed.
5. **Nothing special happens at deep debt.** The UI turns red below zero and stays red; there's no escalating warning, no lockout, no "you must earn X before spending again". If the owner wants the debt to bite harder later, that's a deliberate feature, not something to invent now.
