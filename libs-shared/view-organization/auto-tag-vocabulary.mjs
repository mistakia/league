// Closed set of strings emitted by the deterministic 4-axis auto-tagger.
// Axis 1 — Subject: player-stats | team-stats | defense-stats
// Axis 2 — Position: qb | rb | wr | te | multi-position | team-level
// Axis 3 — Metric domain: opportunity | efficiency | betting-markets | projections | trade-values | play-by-play
// Axis 4 — Time horizon: current-week | season-to-date | multi-season | historical
//
// Imported by:
//   - app/core/data-views/derive-auto-tags.js (front-end taxonomy implementation)
//   - scripts/generate-data-view-llm-tags.mjs (LLM exclusion list)
//
// IMPORTANT: any tag value in this set is reserved for the deterministic tagger.
// The LLM job rejects any generated tag whose value appears in AUTO_TAG_VOCABULARY_SET
// so LLM output is strictly complementary to deterministic auto-tags.

export const AUTO_TAG_VOCABULARY_ARRAY = [
  // Axis 1 — Subject
  'player-stats',
  'team-stats',
  'defense-stats',
  // Axis 2 — Position
  'qb',
  'rb',
  'wr',
  'te',
  'multi-position',
  'team-level',
  // Axis 3 — Metric domain
  'opportunity',
  'efficiency',
  'betting-markets',
  'projections',
  'trade-values',
  'play-by-play',
  // Axis 4 — Time horizon
  'current-week',
  'season-to-date',
  'multi-season',
  'historical'
]

export const AUTO_TAG_VOCABULARY_SET = new Set(AUTO_TAG_VOCABULARY_ARRAY)
