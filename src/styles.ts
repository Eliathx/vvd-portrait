import { HEIGHT, WIDTH } from "@/model"

// ── Styles ───────────────────────────────────────────────────────────────────
// Neutral, translucent surfaces so we sit on the host's own panel in light or
// dark mode; the warm accent comes from the host theme when it has one.

export const CSS = `
.pm-shell { position: relative; width: 100%; height: 100%; min-height: 100%; color: inherit; font: inherit;
  /* With surface "plain" the world shows through; give ourselves the frosted backdrop. */
  background: color-mix(in srgb, var(--background, #16110b) 72%, transparent);
  backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px); }
.pm { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 28px; align-items: start;
  width: 100%; height: 100%; overflow-y: auto; box-sizing: border-box;
  padding: 28px clamp(16px, 3vw, 40px) 40px; color: inherit; font: inherit; }
.pm-narrow { grid-template-columns: minmax(0, 1fr); justify-items: center; }
.pm-stage { display: grid; gap: 14px; justify-items: center; }

.pm-frame { border-radius: 12px; overflow: hidden; line-height: 0; box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35); }
.pm-mat { line-height: 0; }
.pm-pixels { display: block; image-rendering: pixelated; image-rendering: crisp-edges; }


/* The portrait's tool bar: floats over the bottom-right corner, shown on hover,
   on keyboard focus, and while a card is being picked or saved. Always shown on
   touch screens, where there is no hover. */
.pm-frame-wrap { position: relative; line-height: 0; }
.pm-toolbar { position: absolute; right: 10px; bottom: 10px; display: flex; gap: 2px; padding: 4px;
  border-radius: 12px; background: rgba(18, 15, 12, 0.6); border: 1px solid rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); color: #f2ebe1; line-height: normal;
  opacity: 0; transform: translateY(4px); pointer-events: none; transition: opacity 0.15s ease, transform 0.15s ease; }
.pm-frame-wrap:hover .pm-toolbar, .pm-toolbar:focus-within, .pm-toolbar[data-active] {
  opacity: 1; transform: none; pointer-events: auto; }
@media (hover: none) { .pm-toolbar { opacity: 1; transform: none; pointer-events: auto; } }
@media (prefers-reduced-motion: reduce) { .pm-toolbar { transition: none; } }
.pm-tool { width: 34px; height: 34px; padding: 0; border: 0; border-radius: 8px; background: transparent; color: inherit;
  display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
.pm-tool:hover { background: rgba(255, 255, 255, 0.14); }
.pm-tool:disabled { opacity: 0.45; cursor: default; background: transparent; }
/* The main action: the theme's accent, set a little apart from the tools. */
.pm-tool-primary { margin-left: 4px; background: var(--pm-accent); color: #1a140e; }
.pm-tool-primary:hover { background: color-mix(in srgb, var(--pm-accent) 85%, white); }
.pm-tool-primary:disabled { background: var(--pm-accent); }
.pm-tool svg { width: 18px !important; height: 18px !important; flex: none; }
.pm-tool circle { fill: none; }
/* The card list opens upward from the bar, aligned to its right edge. */
.pm-toolbar .pm-cards { top: auto; bottom: calc(100% + 10px); left: auto; right: -4px; transform: none; }
.pm-cards { position: absolute; z-index: 40; top: calc(100% + 8px); left: 50%; transform: translateX(-50%); width: 280px;
  display: grid; gap: 8px; padding: 10px; border-radius: 12px; background: rgba(24, 20, 16, 0.97); color: #ece3d6;
  border: 1px solid rgba(255, 235, 205, 0.14); box-shadow: 0 14px 32px rgba(0, 0, 0, 0.5); }
.pm-cards-search { width: 100%; box-sizing: border-box; padding: 8px 10px; border-radius: 8px; font: inherit; font-size: 14px;
  color: inherit; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.14); outline: none; }
.pm-cards-search:focus { border-color: var(--pm-accent); }
.pm-cards-list { list-style: none; margin: 0; padding: 0; max-height: 240px; overflow-y: auto; display: grid; gap: 2px; }
.pm-cards-item { width: 100%; display: flex; justify-content: space-between; gap: 8px; padding: 7px 10px; border: 0;
  border-radius: 7px; background: transparent; color: inherit; font: inherit; font-size: 14px; text-align: left; cursor: pointer; }
.pm-cards-item[data-active] { background: rgba(255,255,255,0.09); }
.pm-cards-item small { opacity: 0.55; }
.pm-cards-empty { margin: 4px 2px; font-size: 13px; opacity: 0.6; }
.pm-cards-create { padding: 8px 10px; border-radius: 8px; border: 1px dashed rgba(255,255,255,0.25); background: transparent;
  color: inherit; font: inherit; font-size: 14px; text-align: left; cursor: pointer; }

.pm-controls { display: grid; gap: 16px; min-width: 0; width: 100%; }
.pm-tabs { display: flex; flex-wrap: wrap; gap: 6px; }
.pm-tab { padding: 7px 14px; border-radius: 999px; border: 1px solid transparent; background: transparent;
  color: inherit; font: inherit; font-size: 14px; opacity: 0.65; cursor: pointer; }
.pm-tab:hover { opacity: 1; background: rgba(127,127,127,0.1); }
.pm-tab[aria-selected="true"] { opacity: 1; border-color: rgba(127,127,127,0.35); background: rgba(127,127,127,0.14); }

/* Pieces scroll inside their own area (two rows, with a peek of the third so the
   scroll is discoverable), so a long list never pushes the position control away. */
.pm-pieces { display: flex; flex-wrap: wrap; gap: 10px; align-content: flex-start;
  max-height: 300px; overflow-y: auto; padding: 2px 6px 2px 2px; margin: -2px -6px -2px -2px;
  overscroll-behavior: contain; scrollbar-width: thin; scrollbar-color: rgba(127,127,127,0.4) transparent; }
.pm-piece { padding: 4px; line-height: 0; border-radius: 10px; border: 1px solid rgba(127,127,127,0.25);
  background: rgba(127,127,127,0.08); cursor: pointer; }
.pm-piece:hover { border-color: rgba(127,127,127,0.6); }
.pm-piece-none { width: ${WIDTH + 10}px; height: ${HEIGHT + 10}px; box-sizing: border-box; line-height: 1.2;
  display: inline-flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px;
  border-style: dashed; color: inherit; font: inherit; font-size: 13px; opacity: 0.8; }
.pm-piece-none svg { width: 22px !important; height: 22px !important; }
.pm-piece[aria-pressed="true"] { border-color: var(--pm-accent); box-shadow: 0 0 0 1px var(--pm-accent); }

.pm-offset { display: flex; align-items: center; gap: 6px; margin-top: -4px; }
.pm-offset .pm-label { margin-right: 4px; }
.pm-offset-step { width: 30px; height: 28px; padding: 0; border-radius: 8px; border: 1px solid rgba(127,127,127,0.3);
  background: rgba(127,127,127,0.08); color: inherit; font-size: 11px; cursor: pointer; }
.pm-offset-step:hover:not(:disabled) { border-color: rgba(127,127,127,0.6); }
.pm-offset-step:disabled { opacity: 0.35; cursor: default; }
.pm-offset-value { min-width: 34px; padding: 0 4px; border: 0; background: none; color: inherit; font: inherit;
  font-size: 13.5px; font-variant-numeric: tabular-nums; text-align: center; cursor: pointer; }
.pm-offset-step:focus-visible, .pm-offset-value:focus-visible { outline: 2px solid var(--pm-accent); outline-offset: 2px; }

.pm-colors { display: grid; gap: 10px; max-width: 100%; box-sizing: border-box; }
.pm-color-row { display: grid; gap: 6px; }
.pm-label { font-size: 13.5px; opacity: 0.6; }
/* One row of equal squares that shrink to the portrait's width (max 34px each). */
.pm-swatches { display: grid; grid-template-columns: repeat(var(--pm-swatch-count, 9), minmax(0, 34px));
  justify-content: space-between; gap: 6px; }
.pm-swatches .pm-picker-anchor { display: block; }
.pm-swatches .pm-swatch { width: 100%; height: auto; aspect-ratio: 1; }
/* The last swatch opens the picker: align it to the row's right edge so it stays over the column. */
.pm-swatches .pm-picker { left: auto; right: 0; }
.pm-swatch { position: relative; width: 34px; height: 34px; padding: 0; border-radius: 8px; cursor: pointer;
  border: 1px solid rgba(0,0,0,0.35); box-shadow: inset 0 0 0 1px rgba(255,255,255,0.12); }
.pm-swatch:hover { transform: translateY(-1px); }
.pm-tool:focus-visible, .pm-tab:focus-visible, .pm-piece:focus-visible, .pm-swatch:focus-visible,
.pm-cards-item:focus-visible, .pm-cards-create:focus-visible {
  outline: 2px solid var(--pm-accent); outline-offset: 2px; }
.pm-swatch[aria-pressed="true"] { outline: 2px solid var(--pm-accent); outline-offset: 2px; }
.pm-swatch-custom { background: conic-gradient(from 90deg, #c0504d, #d9a441, #4fa38a, #3a5fb8, #7d3fa0, #c0504d); }

.pm-picker-anchor { position: relative; display: inline-flex; }
.pm-picker { position: absolute; z-index: 40; top: calc(100% + 8px); left: 0; width: 260px; display: grid; gap: 12px;
  padding: 12px; border-radius: 12px; background: rgba(24, 20, 16, 0.97); color: #ece3d6;
  border: 1px solid rgba(255, 235, 205, 0.14); box-shadow: 0 14px 32px rgba(0, 0, 0, 0.5); }
.pm-picker-sv { position: relative; height: 170px; border-radius: 8px; cursor: crosshair; touch-action: none; }
.pm-picker-hue { position: relative; height: 14px; border-radius: 999px; cursor: pointer; touch-action: none;
  background: linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00); }
.pm-picker-thumb { position: absolute; width: 16px; height: 16px; border-radius: 50%; transform: translate(-50%, -50%);
  border: 2px solid #fff; box-shadow: 0 0 0 1px rgba(0,0,0,0.5), 0 2px 4px rgba(0,0,0,0.4); pointer-events: none; }
.pm-picker-footer { display: flex; align-items: center; gap: 8px; font-size: 13.5px; }
.pm-picker-chip { width: 22px; height: 22px; border-radius: 5px; border: 1px solid rgba(255,255,255,0.2); }
.pm-picker-hex { flex: 1; min-width: 0; box-sizing: border-box; padding: 5px 8px; border-radius: 7px;
  border: 1px solid rgba(127,127,127,0.3); background: rgba(127,127,127,0.08); color: inherit;
  font-family: ui-monospace, monospace; font-size: 13.5px; outline: none; }
.pm-picker-hex:focus { border-color: var(--pm-accent); }
.pm-picker-hex[aria-invalid="true"] { border-color: #c0504d; }
`

