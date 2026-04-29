// Position color lookup for scatter plot overlays and similar visualizations.
// Canonical hex values live in app/styles/variables.styl as CSS custom properties
// on :root (--pos-QB, --pos-RB, etc.). This module reads them at runtime via
// getComputedStyle so there is a single source of truth — no hex literals here.

const DEFAULT_COLOR = '#666666'

/**
 * Returns the CSS custom-property color for a given NFL position string.
 * Falls back to DEFAULT_COLOR when the position is unknown or document is
 * unavailable (SSR / test environments).
 *
 * @param {string} position - Position abbreviation e.g. 'QB', 'RB', 'WR', 'TE', 'K', 'DST'
 * @returns {string} hex color string
 */
export function get_position_color(position) {
  if (typeof document === 'undefined') return DEFAULT_COLOR
  if (!position) return DEFAULT_COLOR
  const prop = `--pos-${String(position).toUpperCase()}`
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(prop)
    .trim()
  return value || DEFAULT_COLOR
}
