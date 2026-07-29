import db from '#db'

// nfl_play_stats stat_ids that credit a fumble return touchdown to the
// RECOVERING player: own-fumble recovery TD (56), own-fumble recovery TD after
// a lateral (58), opponent-fumble recovery TD (60), and opponent-fumble
// recovery TD after a lateral (62). These are exactly the cases that increment
// stats.fumble_return_touchdowns in
// libs-shared/calculate-stats-from-play-stats.mjs, which is what feeds
// player_gamelogs -- keeping the two lists identical is what makes the
// from-plays and gamelogs scoring paths agree.
export const FUMBLE_RETURN_TOUCHDOWN_STAT_IDS = [56, 58, 60, 62]

const STATS_ALIAS = 'fumble_return_td_stats'
const SMART_ALIAS = 'fumble_return_td_player_smart'
const GSIS_ALIAS = 'fumble_return_td_player_gsis'

// The recoverer is a different player from nfl_plays.player_fuml_pid (the
// fumbler), and nfl_plays carries no usable column for them --
// fumble_recovered_1_pid is NULL even on plays that do have a stat_id 56 row --
// so their identity has to come from nfl_play_stats.
//
// nfl_play_stats keys players by external id rather than pid, and
// generate-player-gamelogs.mjs resolves them by smart_player_id first, falling
// back to gsis_player_id only for players it could not find that way. This
// COALESCE reproduces that precedence deliberately: across the 839 valid
// fumble-return-TD stat rows the two ids resolve 674 and 785 pids
// respectively, they disagree on 2, and either one used alone would leave the
// two scoring paths crediting different players.
export const fumble_return_touchdown_pid_expr = `COALESCE("${SMART_ALIAS}"."pid", "${GSIS_ALIAS}"."pid")`

// Attach the recoverer-identity joins to a query whose base relation is
// `plays_table` (the physical nfl_plays for the role-union path, the
// filtered_plays CTE for the `with` path). The inner join on nfl_play_stats is
// what restricts the role to fumble-return-TD plays, so no separate measure
// predicate is needed; it cannot fan out because no play carries more than one
// of these stat rows.
export const apply_fumble_return_touchdown_joins = ({ query, plays_table }) => {
  query
    .innerJoin(`nfl_play_stats as ${STATS_ALIAS}`, function () {
      this.on(`${STATS_ALIAS}.esbid`, '=', `${plays_table}.esbid`)
        .andOn(`${STATS_ALIAS}.play_id`, '=', `${plays_table}.play_id`)
        .andOnIn(`${STATS_ALIAS}.stat_id`, FUMBLE_RETURN_TOUCHDOWN_STAT_IDS)
        .andOn(db.raw(`"${STATS_ALIAS}"."valid" = true`))
    })
    .leftJoin(
      `player as ${SMART_ALIAS}`,
      `${SMART_ALIAS}.smart_player_id`,
      `${STATS_ALIAS}.smart_player_id`
    )
    .leftJoin(
      `player as ${GSIS_ALIAS}`,
      `${GSIS_ALIAS}.gsis_player_id`,
      `${STATS_ALIAS}.gsis_player_id`
    )
}
