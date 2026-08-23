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

// Position-specific scoring: a format may award a different value to a given
// position for a given stat. Keyed by (overridden stat, position) so any stat
// can carry overrides -- `receptions` has three (RB/WR/TE) and
// `receiving_first_downs` has the tight-end premium SFB16 needs. Positions with
// no override for a stat (QB/K/DST) fall back to its base value.
const position_override_columns = {}
for (const entry of scoring_registry) {
  if (!entry.overrides_stat || !entry.position) continue
  position_override_columns[entry.overrides_stat] ??= {}
  position_override_columns[entry.overrides_stat][entry.position] = entry.column
}

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

// When a format says a touchdown does NOT also count as a first down, each
// first-down stat is replaced by its excluding-touchdowns twin. Structurally
// the same substitution as is_excluding_quarterback_kneels below.
const excluding_touchdown_stats = {
  rushing_first_downs: 'rushing_first_downs_excluding_touchdowns',
  receiving_first_downs: 'receiving_first_downs_excluding_touchdowns'
}

// Bonus rules. Each is { type, stat, threshold, points }.
//
//   milestone  adds `points` once when the game aggregate for `stat` reaches
//              `threshold`. Reads a scalar already on the gamelog.
//   big_play   adds `points` per PLAY of `stat` gaining at least `threshold`.
//              Reads a per-play array the caller attaches to `stats`.
//
// An unknown type or an unreadable stat scores 0 rather than throwing, so a
// config written for a newer engine does not crash an older one.
//
// `rush_rec_yd` is derived rather than stored: it is the only milestone stat
// that spans two gamelog columns.
const milestone_stat_value = (stats) => ({
  passing_yards: stats.passing_yards || 0,
  rushing_yards: stats.rushing_yards || 0,
  receiving_yards: stats.receiving_yards || 0,
  rush_rec_yd: (stats.rushing_yards || 0) + (stats.receiving_yards || 0)
})

// Per-play yardage arrays, when the caller supplies them. Absent for
// projections and for live weekly scoring, where big plays are not knowable --
// so a big_play rule silently scores 0 there. That is correct (a big play is
// realized, not projectable) but it is a systematic under-count for any format
// carrying such a rule, and it is documented rather than left implicit.
const big_play_lengths = (stats) => ({
  passing_yards: stats.pass_play_yards,
  rushing_yards: stats.rush_play_yards,
  receiving_yards: stats.recv_play_yards
})

const score_bonuses = ({ stats, bonuses }) => {
  if (!Array.isArray(bonuses) || !bonuses.length) {
    return 0
  }

  const milestones = milestone_stat_value(stats)
  const lengths = big_play_lengths(stats)
  let total = 0

  for (const rule of bonuses) {
    if (!rule || typeof rule !== 'object') continue
    const points = Number(rule.points) || 0
    const threshold = Number(rule.threshold)
    if (!points || !Number.isFinite(threshold)) continue

    if (rule.type === 'milestone') {
      const value = milestones[rule.stat]
      if (value !== undefined && value >= threshold) {
        total += points
      }
    } else if (rule.type === 'big_play') {
      const plays = lengths[rule.stat]
      if (Array.isArray(plays)) {
        total += points * plays.filter((yards) => yards >= threshold).length
      }
    }
  }

  return total
}

const calculatePoints = ({
  stats,
  position = '',
  league,
  use_projected_stats = false,
  games = 1
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

    // Position-specific scoring. A position override of exactly 0 falls back to
    // the base value rather than scoring nothing -- `||`, not `??`. That is
    // pinned in the characterization spec as current behavior, so it is
    // deliberate here rather than an oversight.
    const overrides = position_override_columns[stat]
    if (overrides) {
      const override_column = overrides[position.toUpperCase()]
      factor = (override_column && league[override_column]) || factor
    }

    // QB kneel exclusion. Only substitute the kneel-adjusted yards when they
    // have been explicitly calculated rather than merely initialized to 0.
    if (
      stat === 'rushing_yards' &&
      league.is_excluding_quarterback_kneels &&
      stats.rushing_yards_excluding_kneels !== undefined &&
      stats.rushing_yards_excluding_kneels !== null &&
      (stats.rushing_yards_excluding_kneels !== 0 || stats.rushing_yards === 0)
    ) {
      stat_value = stats.rushing_yards_excluding_kneels
    }
    // Rate/threshold pairs: only the amount beyond the threshold scores.
    //
    // The threshold is a PER-GAME quantity (20 points allowed, 300 yards
    // allowed), so it must carry the grain of the row being scored. A gamelog
    // row covers one game and takes the threshold as-is; a period row -- week 0
    // holds season totals, as every other stat at week 0 does -- must scale it
    // by the games in the period, or a season points-against of 350 scores as
    // max(350 - 20, 0) * -0.4 = -132 instead of roughly zero.
    //
    // Latent until something populates these two columns at a period grain: the
    // 2026 board carries NULL and every stored 2021-2025 week-0 row carries the
    // fabricated 0.0 predating the weight-projections fix, and both clamp to
    // zero. It arms the moment a real value arrives.
    //
    // Scaling the threshold is exact only when the per-game values are equal,
    // because the rule is convex: sum(max(x_i - t, 0)) >= max(sum(x_i) - n*t, 0)
    // whenever the x_i differ. A team allowing 10 and then 30 against a
    // threshold of 20 scores 10 per-game and 0 on the season total. So a period
    // row systematically UNDERSTATES the penalty, and a season-grain source
    // that wants the exact figure has to carry the per-game distribution rather
    // than the total. Understating by that gap is the intended trade here; the
    // alternative on a total is not a better approximation, it is -132.
    else if (threshold_columns[stat]) {
      const threshold = league_value(league, threshold_columns[stat])
      stat_value = Math.max(stat_value - threshold * games, 0)
    }
    // Touchdowns not counting as first downs: substitute the excluding-TD twin.
    // Read through league_value rather than off the raw property, so a partial
    // config gets the registry default (true) rather than `undefined`, which
    // would read as false and silently change every existing format.
    else if (
      excluding_touchdown_stats[stat] &&
      !league_value(league, 'touchdown_is_first_down')
    ) {
      const excluding = stats[excluding_touchdown_stats[stat]]
      if (excluding !== undefined && excluding !== null) {
        stat_value = excluding
      }
    }

    const score = factor * stat_value
    result[stat] = score
    result.total = result.total + score
  }

  // Bonuses are scored after the registry loop and before the anytime_td tail,
  // because a milestone reads the game aggregate the loop has just consumed and
  // must not itself be rescaled by any per-stat factor.
  const bonus_points = score_bonuses({
    stats,
    bonuses: league_value(league, 'bonuses')
  })
  if (bonus_points) {
    result.bonuses = bonus_points
    result.total += bonus_points
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
