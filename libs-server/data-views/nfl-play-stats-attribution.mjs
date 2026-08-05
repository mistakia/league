import db from '#db'
import {
  stat_ids_for_role,
  fallback_pid_column_for_role
} from '#libs-shared/scoring-stat-roles.mjs'

// Attribution for fantasy roles whose player identity lives in nfl_play_stats
// rather than in a pid column on nfl_plays.
//
// The gamelogs scoring path is built entirely from nfl_play_stats: every stat
// in libs-shared/calculate-stats-from-play-stats.mjs is incremented off a
// stat_id row and credited to that row's player. The from-plays path normally
// reads pid columns on nfl_plays instead, which is cheaper but only works for
// roles nfl_plays actually names (ball carrier, passer, target, fumbler). For
// the roles below it does not, and reading nfl_plays anyway is what made the
// two paths disagree. Each role here reproduces the gamelogs source exactly:
// same stat_ids, same player resolution, one credited row per stat row.
//
// nfl_play_stats keys players by external id rather than pid, and
// generate-player-gamelogs.mjs resolves them by smart_player_id first, falling
// back to gsis_player_id only for players it could not find that way. The
// COALESCE below reproduces that precedence deliberately: across the 839 valid
// fumble-return-TD stat rows the two ids resolve 674 and 785 pids
// respectively, they disagree on 2, and either one used alone would leave the
// two scoring paths crediting different players.
const create_play_stats_attribution = ({
  stat_ids,
  alias_prefix,
  fallback_pid_column
}) => {
  const stats_alias = `${alias_prefix}_stats`
  const smart_alias = `${alias_prefix}_player_smart`
  const gsis_alias = `${alias_prefix}_player_gsis`

  // `pid_expr` is a function of the base relation because the fallback below
  // reads a pid column off it, and the two callers pass different relations
  // (the physical nfl_plays for the role-union path, the filtered_plays CTE for
  // the legacy `with` path). Roles without a fallback ignore the argument.
  const pid_expr = ({ plays_table } = {}) => {
    const resolved = `"${smart_alias}"."pid", "${gsis_alias}"."pid"`
    if (!fallback_pid_column) {
      return `COALESCE(${resolved})`
    }
    // generate-player-gamelogs.mjs patches a stat row that carries NEITHER
    // external id from the matching role pid column on nfl_plays
    // (STAT_ID_TO_ROLE_PID_COLUMN) before resolving it, so the gamelogs path
    // credits a player the stat row itself does not name. Reproduce that, and
    // only in that case: a row that HAS an external id which fails to resolve
    // credits nobody on both paths, so the fallback must stay guarded rather
    // than becoming a plain third COALESCE arm.
    const has_no_external_id =
      `NULLIF("${stats_alias}"."smart_player_id", '') IS NULL AND ` +
      `NULLIF("${stats_alias}"."gsis_player_id", '') IS NULL`
    return (
      `COALESCE(${resolved}, CASE WHEN ${has_no_external_id} ` +
      `THEN "${plays_table}"."${fallback_pid_column}" END)`
    )
  }

  // Attach the identity joins to a query whose base relation is `plays_table`
  // (the physical nfl_plays for the role-union path, the filtered_plays CTE for
  // the legacy `with` path). The inner join on nfl_play_stats is what restricts
  // the role to the relevant plays, so no separate measure predicate is needed.
  //
  // The join fans out to one row per matching stat row, which is intended: a
  // play carrying two stat rows credits two players, exactly as the gamelogs
  // path does. Because the measure is a flat per-row value, SUM over the
  // fanned-out rows reproduces the gamelogs total.
  const apply_joins = ({ query, plays_table }) => {
    query
      .innerJoin(`nfl_play_stats as ${stats_alias}`, function () {
        this.on(`${stats_alias}.esbid`, '=', `${plays_table}.esbid`)
          .andOn(`${stats_alias}.play_id`, '=', `${plays_table}.play_id`)
          .andOnIn(`${stats_alias}.stat_id`, stat_ids)
          .andOn(db.raw(`"${stats_alias}"."is_valid" = true`))
      })
      .leftJoin(
        `player as ${smart_alias}`,
        `${smart_alias}.smart_player_id`,
        `${stats_alias}.smart_player_id`
      )
      .leftJoin(
        `player as ${gsis_alias}`,
        `${gsis_alias}.gsis_player_id`,
        `${stats_alias}.gsis_player_id`
      )
  }

  return { stat_ids, pid_expr, apply_joins }
}

// stat_ids that credit a fumble return touchdown to the RECOVERING player:
// own-fumble recovery TD (56), own-fumble recovery TD after a lateral (58),
// opponent-fumble recovery TD (60), and opponent-fumble recovery TD after a
// lateral (62). The recoverer is a different player from
// nfl_plays.player_fuml_pid (the fumbler), and nfl_plays carries no usable
// column for them -- fumble_recovered_1_pid is NULL even on plays that do have
// a stat_id 56 row.
export const FUMBLE_RETURN_TOUCHDOWN_STAT_IDS = stat_ids_for_role(
  'fumble_return_touchdown'
)

// Fumble Lost (106) is the stat_id the gamelogs path increments
// fumbles_lost on. nfl_plays.player_fuml_pid is NOT equivalent: it is set on
// every play carrying a fumble at all, including aborted snaps and own-fumble
// recoveries where no fumble was lost to the opponent. Scoring the penalty off
// that column over-charged 15,870 REG plays against the gamelogs path's 7,968
// -- a greater-than-2x over-penalization in every scoring format, and the
// reason C.J. Stroud was charged for the aborted snap on which his own team
// recovered (esbid 2025121402, play_id 653) while his gamelog reads
// fumbles_lost = 0. nfl_plays.is_fumble_lost is a closer proxy but still not the
// same set (307 REG plays are true there with no stat_id 106 row), so the stat
// rows are the source of truth here as everywhere else in this module.
export const FUMBLE_LOST_STAT_IDS = stat_ids_for_role('fumble_lost')

// stat_ids that credit a punt return touchdown (34) or the same after a lateral
// (36), and a kickoff return touchdown (46) or the same after a lateral (48).
// Like the fumble-return-TD stat_ids, none of these appear in
// generate-player-gamelogs.mjs STAT_ID_TO_ROLE_PID_COLUMN, so neither role
// carries a fallback: nfl_plays names no returner column these could read.
export const PUNT_RETURN_TOUCHDOWN_STAT_IDS = stat_ids_for_role(
  'punt_return_touchdown'
)
export const KICKOFF_RETURN_TOUCHDOWN_STAT_IDS = stat_ids_for_role(
  'kickoff_return_touchdown'
)

export const fumble_return_touchdown_attribution =
  create_play_stats_attribution({
    stat_ids: FUMBLE_RETURN_TOUCHDOWN_STAT_IDS,
    alias_prefix: 'fumble_return_td'
  })

export const punt_return_touchdown_attribution = create_play_stats_attribution({
  stat_ids: PUNT_RETURN_TOUCHDOWN_STAT_IDS,
  alias_prefix: 'punt_return_td'
})

export const kickoff_return_touchdown_attribution =
  create_play_stats_attribution({
    stat_ids: KICKOFF_RETURN_TOUCHDOWN_STAT_IDS,
    alias_prefix: 'kickoff_return_td'
  })

// Two point conversions: rush (75), pass (77) and reception (104). nfl_plays
// carries no column naming the converting player, and the gamelogs path credits
// BOTH the passer and the receiver on a two-point pass because each gets its own
// stat row -- the join's fan-out reproduces that without special handling.
export const TWO_POINT_CONVERSION_STAT_IDS = stat_ids_for_role(
  'two_point_conversion'
)

export const two_point_conversion_attribution = create_play_stats_attribution({
  stat_ids: TWO_POINT_CONVERSION_STAT_IDS,
  alias_prefix: 'two_point_conversion'
})

// Field goals (70) and extra points (72). These stat ids are deliberately NOT
// in libs-shared/scoring-stat-roles.mjs and are declared here instead: that
// registry's scope is one stat row, one increment, and on the GAMELOGS path 70
// increments five fields while 72 increments both `xpa` and `extra_points_made`.
// On the SCORING path the shapes differ again -- an extra point is flat (only
// extra_points_made is a scoring column; xpa is an attempt count nothing scores)
// while a field goal is not, because its value depends on the kick distance.
//
// Measured against production, 2025 REG: nfl_plays.kicker_pid is populated on
// 0 of the 931 valid stat_id 70 rows and 2 of the 1,210 stat_id 72 rows, so a
// kicker_pid-sourced role would join correctly and return nothing -- the same
// trap the two-point role sprang. The stat rows themselves do carry an external
// id (929 and 1,201 respectively), which is why the attribution shape below is
// the right one. Both roles therefore also need the EXISTS gate widening.
export const FIELD_GOAL_STAT_IDS = [70]
export const EXTRA_POINT_STAT_IDS = [72]

// The field-goal scoring expression reads the kick distance off this alias's
// `stat_yards` column, which is why the alias prefix is part of the module's
// contract rather than an internal detail. Every one of the 931 valid stat_id
// 70 rows carries a distance, spanning 19 to 68.
export const FIELD_GOAL_STATS_ALIAS = 'field_goal_stats'

export const field_goal_attribution = create_play_stats_attribution({
  stat_ids: FIELD_GOAL_STAT_IDS,
  alias_prefix: 'field_goal'
})

export const extra_point_attribution = create_play_stats_attribution({
  stat_ids: EXTRA_POINT_STAT_IDS,
  alias_prefix: 'extra_point'
})

export const fumble_lost_attribution = create_play_stats_attribution({
  stat_ids: FUMBLE_LOST_STAT_IDS,
  alias_prefix: 'fumble_lost',
  // The registry maps 106 -> player_fuml_pid, and it is the same value
  // generate-player-gamelogs.mjs patches from. The fumble-return-TD stat_ids
  // carry null there, which is why only this role gets a fallback.
  fallback_pid_column: fallback_pid_column_for_role('fumble_lost')
})
