// Deterministic 4-axis auto-tagger for data views.
// Pure function — no side effects. Render-time only; auto-tags are never persisted.
//
// Axes:
//   1 — Subject:      player-stats | team-stats | defense-stats
//   2 — Position:     qb | rb | wr | te | multi-position | team-level
//   3 — Metric domain: opportunity | efficiency | betting-markets | projections | trade-values | play-by-play
//   4 — Time horizon: current-week | season-to-date | multi-season | historical

// Dev assertion: validate all emitted tags are in the vocabulary.
// Uses a dynamic import shim pattern that works in both browser and Node.
let AUTO_TAG_VOCABULARY_SET = null
let vocabulary_validated = false

function assert_vocabulary_in_dev(tags) {
  if (process.env.NODE_ENV !== 'development' || vocabulary_validated) return
  // Lazy-load the vocabulary set from the shared module. This runs once at
  // module-load time via the first call to derive_auto_tags in a dev session.
  import('@libs-shared/view-organization/auto-tag-vocabulary.mjs')
    .then(({ AUTO_TAG_VOCABULARY_SET: vocab }) => {
      AUTO_TAG_VOCABULARY_SET = vocab
      vocabulary_validated = true
      for (const tag of tags) {
        if (!AUTO_TAG_VOCABULARY_SET.has(tag)) {
          console.error(
            `[derive-auto-tags] Dev assertion: emitted tag "${tag}" is not in AUTO_TAG_VOCABULARY_SET`
          )
        }
      }
    })
    .catch(() => {
      // If the import fails (e.g. in test), skip validation silently
    })
}

// ======================================
// Axis 1 — Subject
// ======================================

function derive_subject(column_ids) {
  if (!column_ids || !column_ids.length) return null

  // Check for defense-stats first (pff_team_grades or coverage columns)
  const has_defense = column_ids.some(
    (id) =>
      (typeof id === 'string' && id.includes('pff_team_grades')) ||
      (typeof id === 'string' && id.includes('coverage'))
  )
  if (has_defense) return 'defense-stats'

  const total = column_ids.length
  let player_count = 0
  let team_count = 0

  for (const id of column_ids) {
    if (typeof id !== 'string') continue
    if (id.startsWith('player_')) player_count++
    else if (id.startsWith('team_')) team_count++
  }

  if (player_count / total > 0.5) return 'player-stats'
  if (team_count / total > 0.5) return 'team-stats'

  return null
}

// ======================================
// Axis 2 — Position
// ======================================

const POSITION_PATTERNS = [
  { tag: 'qb', regex: /\bQB\b/i },
  { tag: 'rb', regex: /\bRB\b/i },
  { tag: 'wr', regex: /\bWR\b/i },
  { tag: 'te', regex: /\bTE\b/i }
]

function derive_position(view, subject) {
  const where = view.table_state && view.table_state.where
  const view_name = view.view_name || ''

  // Rule 1: where[player_position] present and single value
  if (where) {
    const pos_filter = where.find
      ? where.find(
          (w) =>
            (w.column_id === 'player_position' ||
              w.column_id === 'player_position_filter') &&
            w.value
        )
      : null

    if (pos_filter) {
      const values = Array.isArray(pos_filter.value)
        ? pos_filter.value
        : [pos_filter.value]
      if (values.length === 1) {
        const pos = values[0].toLowerCase()
        if (pos === 'qb') return 'qb'
        if (pos === 'rb') return 'rb'
        if (pos === 'wr') return 'wr'
        if (pos === 'te') return 'te'
      }
      // Rule 2: where[player_position] with 2+ values
      if (values.length >= 2) return 'multi-position'
    }
  }

  // Rules 3 & 4: view_name regex
  const matched_positions = POSITION_PATTERNS.filter(({ regex }) =>
    regex.test(view_name)
  )
  if (matched_positions.length === 1) return matched_positions[0].tag
  if (matched_positions.length >= 2) return 'multi-position'

  // Rules 5 & 6: fall back on subject
  if (subject === 'player-stats') return 'multi-position'
  if (subject === 'team-stats' || subject === 'defense-stats')
    return 'team-level'

  return null
}

// ======================================
// Axis 3 — Metric domain
// ======================================

function derive_metric_domain(column_ids) {
  if (!column_ids || !column_ids.length) return null

  for (const id of column_ids) {
    if (typeof id !== 'string') continue

    // betting-markets (first match wins)
    if (/game_prop_/.test(id) || /_betting_markets/.test(id)) {
      return 'betting-markets'
    }
  }

  for (const id of column_ids) {
    if (typeof id !== 'string') continue
    // projections
    if (/_week_projected_/.test(id) || /_season_projected_/.test(id))
      return 'projections'
  }

  for (const id of column_ids) {
    if (typeof id !== 'string') continue
    // trade-values
    if (
      /_keeptradecut_/.test(id) ||
      /_ngs_draft_grade/.test(id) ||
      /_espn_overall_score/.test(id)
    )
      return 'trade-values'
  }

  for (const id of column_ids) {
    if (typeof id !== 'string') continue
    // opportunity
    if (
      /_air_yards_/.test(id) ||
      /_target_share_/.test(id) ||
      /_weighted_opportunity_/.test(id) ||
      /_routes$/.test(id)
    )
      return 'opportunity'
  }

  for (const id of column_ids) {
    if (typeof id !== 'string') continue
    // efficiency
    if (
      /_pff_/.test(id) ||
      /_ngs_/.test(id) ||
      /_espn_/.test(id) ||
      /_expected_points_/.test(id) ||
      /_success_rate_/.test(id)
    )
      return 'efficiency'
  }

  for (const id of column_ids) {
    if (typeof id !== 'string') continue
    // play-by-play (last resort in family)
    if (/_from_plays$/.test(id)) return 'play-by-play'
  }

  return null
}

// ======================================
// Axis 4 — Time horizon
// ======================================

function derive_time_horizon(view) {
  const view_name = view.view_name || ''
  const row_axes = (view.table_state && view.table_state.row_axes) || []

  if (/matchup preview|week \d|this week/i.test(view_name)) {
    return 'current-week'
  }

  if (/by week|weekly/i.test(view_name) && row_axes.length > 0) {
    return 'season-to-date'
  }

  if (/\b\d{4}[-–]\d{4}\b/.test(view_name)) {
    return 'multi-season'
  }

  if (/historical/i.test(view_name)) {
    return 'historical'
  }

  // Default fallback
  return 'season-to-date'
}

// ======================================
// Main export
// ======================================

/**
 * Derive deterministic auto-tags for a view.
 *
 * @param {object} view - The view object from the redux store
 * @param {Object<string, object>} all_columns - Object form {[column_id]: column_def} from table_context
 * @returns {string[]} Array of 0–4 auto-tag strings (one per axis, skipped if null)
 */
export function derive_auto_tags(view, all_columns) {
  if (!view || !view.table_state) return []

  const { columns = [], prefix_columns = [] } = view.table_state

  // Collect all column_ids in use
  const all_column_ids = [
    ...prefix_columns,
    ...columns.map((c) => (typeof c === 'string' ? c : c.column_id))
  ].filter(Boolean)

  const subject = derive_subject(all_column_ids)
  const position = derive_position(view, subject)
  const metric_domain = derive_metric_domain(all_column_ids)
  const time_horizon = derive_time_horizon(view)

  const tags = [subject, position, metric_domain, time_horizon].filter(Boolean)

  // Dev assertion: all emitted tags must be in the vocabulary
  if (process.env.NODE_ENV === 'development') {
    assert_vocabulary_in_dev(tags)
  }

  return tags
}

export default derive_auto_tags
