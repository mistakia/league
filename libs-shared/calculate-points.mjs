import { projected_base_stats } from '#constants'
import {
  scoring_registry,
  stat_names_for_group,
  default_value_for_column
} from '#libs-shared/scoring-columns.mjs'

// Reads a per-league value, falling back to the registry default when the
// config does not carry the column at all.
//
// The fallback is load bearing and is the read-side twin of the fill in
// find-or-create-format. Not every `league` object reaching this function is a
// full league_scoring_formats row -- the named format definitions in
// league-format-definitions.mjs declare only the base columns, and so do the
// configs a caller assembles by hand. Before kicking and DST were configurable
// their values were hardcoded here, so such a caller scored them correctly by
// construction; without this fallback the same caller would silently score
// every kicking and DST stat at ZERO, changing scores with no error anywhere.
// The registry defaults ARE the literals this file used to carry, so the
// fallback reproduces the old behaviour exactly.
//
// `??` rather than `||`, because a league that deliberately zeroes a value must
// keep that zero rather than inherit the default.
const league_value = (league, column) => {
  const configured = league[column]
  if (configured !== undefined && configured !== null) {
    return configured
  }
  return default_value_for_column(column) ?? 0
}

// Position-specific reception scoring: a scoring format may award a different
// per-reception value to running backs, wide receivers, and tight ends. The
// league_scoring_formats config carries one column per position; positions
// without an override (QB/K/DST) fall back to the base `receptions` value.
const position_reception_columns = Object.fromEntries(
  scoring_registry
    .filter((entry) => entry.overrides_stat === 'receptions' && entry.position)
    .map((entry) => [entry.position, entry.column])
)

// Every scored stat, in registry order, paired with the config column holding
// its per-league value. An entry with no column is deliberately unscored and
// still emits a key, because the whole result object is persisted and its key
// set is a contract -- see the characterization spec's `result shape` block.
const scored_stats = scoring_registry
  .filter((entry) => entry.stat)
  .map((entry) => ({ stat: entry.stat, column: entry.column }))

// The two DST rate/threshold pairs. Each scores per unit ALLOWED BEYOND its
// threshold, replacing the hardcoded `max(points_against - 20, 0) * -0.4` and
// `max(yards_against - 300, 0) * -0.02` this file used to carry.
const threshold_columns = {
  defensive_points_against: 'defensive_points_against_threshold',
  defensive_yards_against: 'defensive_yards_against_threshold'
}

const calculatePoints = ({
  stats,
  position = '',
  league,
  use_projected_stats = false
}) => {
  // The projected path scores a narrower base stat set -- a projection source
  // supplies no first downs and no kneel-adjusted rushing yards. Kicking and
  // DST are scored on both paths, as they always have been.
  const excluded_base_stats = use_projected_stats
    ? stat_names_for_group('base').filter(
        (stat) => !projected_base_stats.includes(stat)
      )
    : []

  const result = { total: 0 }

  for (const { stat, column } of scored_stats) {
    if (excluded_base_stats.includes(stat)) {
      continue
    }

    let factor = column ? league_value(league, column) : 0
    let stat_value = stats[stat] || 0

    // Position-specific reception scoring. A position override of exactly 0
    // falls back to the base `receptions` value rather than scoring nothing --
    // pinned in the characterization spec as current behavior.
    if (stat === 'receptions') {
      const override_column = position_reception_columns[position.toUpperCase()]
      factor = (override_column && league[override_column]) || factor
    }
    // QB kneel exclusion. Only substitute the kneel-adjusted yards when they
    // have been explicitly calculated rather than merely initialized to 0.
    else if (
      stat === 'rushing_yards' &&
      league.exclude_quarterback_kneels &&
      stats.rushing_yards_excluding_kneels !== undefined &&
      stats.rushing_yards_excluding_kneels !== null &&
      (stats.rushing_yards_excluding_kneels !== 0 || stats.rushing_yards === 0)
    ) {
      stat_value = stats.rushing_yards_excluding_kneels
    }
    // Rate/threshold pairs: only the amount beyond the threshold scores.
    else if (threshold_columns[stat]) {
      const threshold = league_value(league, threshold_columns[stat])
      stat_value = Math.max(stat_value - threshold, 0)
    }

    const score = factor * stat_value
    result[stat] = score
    result.total = result.total + score
  }

  // Handle anytime_td (simulation-specific stat from ANYTIME_TOUCHDOWN market odds)
  // This is a combined rushing+receiving TD expectation, scored at TD value
  // Only used when specific rushing_touchdowns/receiving_touchdowns props are not available
  if (stats.anytime_td !== undefined && stats.anytime_td !== null) {
    const td_factor = league.rushing_touchdowns || 6 // Use rushing TD value, default 6 points
    result.anytime_td = stats.anytime_td * td_factor
    result.total += result.anytime_td
  }

  return result
}

export default calculatePoints
