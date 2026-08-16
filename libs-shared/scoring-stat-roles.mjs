/**
 * Stat-role registry — the single source for how a FLAT per-event fantasy stat
 * is derived from `nfl_play_stats` rows.
 *
 * The same stat-id knowledge was written down in three places that had to agree
 * by hand, and nothing checked them:
 *
 *   - the switch in libs-shared/calculate-stats-from-play-stats.mjs
 *   - the exported id arrays in libs-server/data-views/nfl-play-stats-attribution.mjs
 *   - STAT_ID_TO_ROLE_PID_COLUMN in scripts/generate-player-gamelogs.mjs
 *
 * The invariant that every id owned by the attribution module is also a `case`
 * in the switch was maintained by a prose comment. It is now derived, and
 * test/libs-shared.scoring-stat-roles.spec.mjs asserts no id appears in both
 * this registry and a bespoke `case` in the switch.
 *
 * libs-shared/calculate-dst-stats-from-plays.mjs is deliberately NOT a consumer,
 * against the plan that scoped this work as a fourth duplicated surface. Its
 * switch shares stat ids with the player path and gives them DIFFERENT meanings,
 * resolved per team rather than per player. Stat 56 (own-fumble recovery TD)
 * credits `fumble_return_touchdowns` to the recovering player here, and in that
 * file adds 6 to `defensive_points_against` for the team that was scored on;
 * 60 credits the same player stat here and `defensive_recovered_fumbles` plus
 * `defensive_touchdowns` there, gated on `fixTeam(playStat.nfl_team) === team`.
 * Those are not duplicated knowledge that drifted -- they are two different
 * questions asked of one feed, and collapsing them onto shared entries would
 * mean encoding team-relative branching in a registry whose whole value is that
 * it has none.
 *
 * SCOPE, deliberately narrow: one stat row, one increment. That is the whole
 * boundary and it is what makes a registry lookup a safe substitute for a
 * `case`.
 *
 * Field goals (70) and extra points (72) are therefore NOT here, against the
 * plan's parenthetical but per its own stated scope. Stat 70 increments five
 * fields and selects a distance band off `playStat.yards`; stat 72 increments
 * both `xpa` and `extra_points_made`, and `xpa` is shared with the missed-kick
 * case (73). Neither is a flat increment, and forcing them in would mean
 * encoding a conditional in data — the exact complexity the 621-line switch
 * keeps for the cases that genuinely need it.
 *
 * `fallback_pid_column` names the `nfl_plays` column that identifies the
 * credited player when a stat row carries neither gsis_player_id nor
 * smart_player_id. `null` means nfl_plays has no usable column for the role --
 * for the four return-touchdown ids this is a real absence rather than an
 * oversight: nfl_plays names no returner, and fumble_recovered_1_pid is NULL
 * even on plays that do carry a stat_id 56 row.
 *
 * Pure data. No `#db` import, safe in the SPA bundle.
 */

export const scoring_stat_roles = [
  {
    name: 'punt_return_touchdown',
    stat_ids: [34, 36],
    increments: ['punt_return_touchdowns'],
    alias_prefix: 'punt_return_td',
    fallback_pid_column: null
  },
  {
    name: 'kickoff_return_touchdown',
    stat_ids: [46, 48],
    increments: ['kickoff_return_touchdowns'],
    alias_prefix: 'kickoff_return_td',
    fallback_pid_column: null
  },
  {
    // Credits the RECOVERING player, who is a different player from
    // nfl_plays.fumble_lost_pid (the fumbler). Own-fumble recovery TD (56) and
    // after a lateral (58); opponent-fumble recovery TD (60) and after a
    // lateral (62).
    name: 'fumble_return_touchdown',
    stat_ids: [56, 58, 60, 62],
    increments: ['fumble_return_touchdowns'],
    alias_prefix: 'fumble_return_td',
    fallback_pid_column: null
  },
  {
    // 106 is the only id the gamelogs path counts a lost fumble on.
    // nfl_plays.fumble_lost_pid is NOT equivalent -- it is set on every play
    // carrying a fumble at all, including aborted snaps and own-fumble
    // recoveries where nothing was lost, which over-penalized 15,870 REG plays
    // against this path's 7,968. It is still the right FALLBACK identity for a
    // stat row that has one, since a 106 row names the player who lost it.
    name: 'fumble_lost',
    stat_ids: [106],
    increments: ['fumbles_lost'],
    alias_prefix: 'fumble_lost',
    fallback_pid_column: 'fumble_lost_pid'
  },
  {
    // Rush (75), pass (77) and reception (104) all credit the same column. The
    // passer and the receiver on a two-point pass each get their own stat row,
    // so this counts both, matching the gamelogs path.
    name: 'two_point_conversion',
    stat_ids: [75, 77, 104],
    increments: ['two_point_conversions'],
    alias_prefix: 'two_point_conversion',
    fallback_pid_column: null
  }
]

export const scoring_stat_role_stat_ids = scoring_stat_roles.flatMap(
  (role) => role.stat_ids
)

// Throws rather than returning undefined: a typo'd role name would otherwise
// produce an empty stat-id list, and an attribution join restricted to no ids
// silently credits nobody instead of failing.
export const stat_ids_for_role = (name) => {
  const role = scoring_stat_roles.find((role) => role.name === name)
  if (!role) throw new Error(`unknown scoring stat role: ${name}`)
  return role.stat_ids
}

export const fallback_pid_column_for_role = (name) => {
  const role = scoring_stat_roles.find((role) => role.name === name)
  if (!role) throw new Error(`unknown scoring stat role: ${name}`)
  return role.fallback_pid_column
}

export const scoring_stat_role_by_stat_id = new Map(
  scoring_stat_roles.flatMap((role) => role.stat_ids.map((id) => [id, role]))
)

export const stat_role_fallback_pid_columns = Object.fromEntries(
  scoring_stat_roles
    .filter((role) => role.fallback_pid_column)
    .flatMap((role) =>
      role.stat_ids.map((id) => [id, role.fallback_pid_column])
    )
)

// Applies the role for `stat_id` to a stats accumulator, and reports whether
// one existed. Callers use the return value to skip their own switch, so a
// registry id and a bespoke case can never both fire for the same row.
export const apply_stat_role = ({ stat_id, stats }) => {
  const role = scoring_stat_role_by_stat_id.get(stat_id)
  if (!role) return false

  for (const field of role.increments) {
    stats[field] += 1
  }

  return true
}
