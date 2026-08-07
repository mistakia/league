import { getLeague } from '#libs-server'
import { current_season, player_tag_types, roster_slot_types } from '#constants'
import { create_static_cache_info } from '#libs-server/data-views/cache-info-utils.mjs'
import { parse_nfl_week_identifier } from '#libs-shared/nfl-week-identifier.mjs'
import { resolve_single_nfl_week_id_if_explicit } from '#libs-server/data-views/resolve-single-nfl-week-id.mjs'
import { sql_integer_param } from '#libs-server/data-views/sanitize-sql-param.mjs'

import db from '#db'
import player_projected_column_definitions from './player-projected-column-definitions.mjs'
import player_espn_score_column_definitions from './player-espn-score-column-definitions.mjs'
import player_betting_market_column_definitions from './player-betting-market-column-definitions.mjs'
import player_table_column_definitions from './player-table-column-definitions.mjs'
import team_table_column_definitions from './team-table-column-definitions.mjs'
import player_league_format_logs_column_definitions from './player-league-format-logs-column-definitions.mjs'
import player_scoring_format_logs_column_definitions from './player-scoring-format-logs-column-definitions.mjs'
import player_stats_from_plays_column_definitions from './player-stats-from-plays-column-definitions.mjs'
import player_fantasy_points_from_plays_column_definitions from './player-fantasy-points-from-plays-column-definitions.mjs'
import defensive_player_stats_from_plays_column_definitions from './defensive-player-stats-from-plays-column-definitions.mjs'
import team_stats_from_plays_column_definitions from './team-stats-from-plays-column-definitions.mjs'
import player_keeptradecut_column_definitions from './player-keeptradecut-column-definitions.mjs'
import player_games_played_column_definitions from './player-games-played-column-definitions.mjs'
import player_contract_column_definitions from './player-contract-column-definitions.mjs'
import player_pff_seasonlogs_column_definitions from './player-pff-seasonlogs-column-definitions.mjs'
import player_dfs_salaries_column_definitions from './player-dfs-salaries-column-definitions.mjs'
import player_dfs_ownership_column_definitions from './player-dfs-ownership-column-definitions.mjs'
import player_rankings_column_definitions from './player-rankings-column-definitions.mjs'
import player_adp_column_definitions from './player-adp-column-definitions.mjs'
import player_practice_column_definitions from './player-practice-column-definitions.mjs'
import espn_line_win_rates_column_definitions from './espn-line-win-rates-column-definitions.mjs'
import game_column_definitions from './game-column-definitions.mjs'
import player_snaps_column_definitions from './player-snaps-column-definitions.mjs'
import player_routes_column_definitions from './player-routes-column-definitions.mjs'
import player_team_column_definition from './player-team-column-definition.mjs'
import team_dvoa_column_definitions from './team-dvoa-column-definitions.mjs'
import nfl_team_seasonlogs_column_definitions from './nfl-team-seasonlogs-column-definitions.mjs'
import pff_team_grades_column_definitions from './pff-team-grades-column-definitions.mjs'
import player_pfr_season_value_column_definitions from './player-pfr-season-value-column-definitions.mjs'
import player_seasonlogs_column_definitions from './player-seasonlogs-column-definitions.mjs'
import player_extended_salary_column_definitions from './player-extended-salary-column-definitions.mjs'
import player_extended_salary_over_market_column_definitions from './player-extended-salary-over-market-column-definitions.mjs'

// TODO include RESERVE_LONG_TERM
const player_league_roster_status_select = `CASE WHEN rosters_players.slot = ${roster_slot_types.RESERVE_SHORT_TERM} THEN 'injured_reserve' WHEN rosters_players.slot = ${roster_slot_types.PS} THEN 'practice_squad' WHEN rosters_players.slot IS NULL THEN 'free_agent' ELSE 'active_roster' END`

// The league and roster year a `rosters_players` column is scoped to. Sync, so
// the tag SQL below can resolve the same scope the join uses without repeating
// the join's async championship-round lookup (which only bears on `week`).
const resolve_roster_scope = ({ params = {} }) => {
  const lid = sql_integer_param({
    value: params.lid === undefined ? 1 : params.lid,
    param_name: 'lid'
  })

  const resolved_nfl_week_id = resolve_single_nfl_week_id_if_explicit({
    params
  })
  if (resolved_nfl_week_id) {
    const parsed = parse_nfl_week_identifier({
      identifier: resolved_nfl_week_id
    })
    return { lid, year: parsed.year, week: parsed.week }
  }

  const year_param = Array.isArray(params.year) ? params.year[0] : params.year
  const year =
    year_param === undefined || year_param === null
      ? current_season.year
      : sql_integer_param({ value: year_param, param_name: 'year' })

  return { lid, year, week: null }
}

// A restricted free agency tag is private to the team holding it until the
// nomination is ANNOUNCED, which is also the moment it locks -- the API refuses
// to remove the tag or cancel the nomination once `announced_at` is set. Before
// that, only a manager of the tagging team may see it.
//
// This is what makes the column viewer-scoped, so any change here has to keep
// `player_league_roster_tag` in `viewer_scoped_column_ids` or the result cache
// will serve one manager's private tags to everyone.
const restricted_free_agency_tag_is_visible_sql = ({
  params = {},
  data_view_options = {}
}) => {
  const { lid, year } = resolve_roster_scope({ params })
  const { viewer_user_id } = data_view_options

  const announced = `EXISTS (SELECT 1 FROM restricted_free_agency_nominations WHERE restricted_free_agency_nominations.player_id = rosters_players.pid AND restricted_free_agency_nominations.league_id = ${lid} AND restricted_free_agency_nominations.season_year = ${year} AND restricted_free_agency_nominations.announced_at IS NOT NULL)`

  if (!viewer_user_id) {
    return `(${announced})`
  }

  const viewer = sql_integer_param({
    value: viewer_user_id,
    param_name: 'viewer_user_id'
  })
  const is_own_team = `rosters_players.tid IN (SELECT users_teams.tid FROM users_teams WHERE users_teams.userid = ${viewer} AND users_teams.season_year = ${year})`

  return `(${is_own_team} OR ${announced})`
}

// A free agent has no roster row, so `tag` is NULL and the CASE falls through to
// NULL rather than to 'regular' -- an unrostered player carries no tag at all.
//
// A hidden restricted free agency tag renders as 'regular', NOT as NULL. NULL
// is already the unrostered-player value, so a third outcome would itself
// disclose the tag -- "this row is being hidden from you" identifies the tagged
// player exactly as well as the tag does.
const player_league_roster_tag_sql = ({
  params = {},
  data_view_options = {}
} = {}) =>
  `CASE rosters_players.tag WHEN ${player_tag_types.REGULAR} THEN 'regular' WHEN ${player_tag_types.FRANCHISE} THEN 'franchise' WHEN ${player_tag_types.ROOKIE} THEN 'rookie' WHEN ${player_tag_types.RESTRICTED_FREE_AGENCY} THEN (CASE WHEN ${restricted_free_agency_tag_is_visible_sql({ params, data_view_options })} THEN 'restricted_free_agency' ELSE 'regular' END) END`

// One join shared by every column in the `rosters_players` group.
//
// `get_grouped_clauses_by_table` keys groups on table_name and keeps a SINGLE
// join_func per group -- whichever column definition is processed last wins
// (get-data-view-results.mjs:1096-1098). So every column in this group must
// declare the SAME function, or the emitted join depends on column order.
// Deliberately unchanged from what `player_league_roster_status` alone used to
// emit: `player_league_fantasy_team` reads the team name through a correlated
// subquery rather than a second join here, so no view that carries roster
// status sees its SQL change.
const player_league_roster_join = async ({
  query,
  params = {},
  data_view_options = {}
}) => {
  // Roster year defaults to current_season.year (current fantasy year),
  // NOT the week-identifier year which tracks stats_season_year during offseason.
  const { lid, year, week: scoped_week } = resolve_roster_scope({ params })

  let week
  if (scoped_week !== null) {
    week = scoped_week
  } else {
    const league = await getLeague({ lid, year })
    if (league) {
      const championship_round = Array.isArray(league.championship_round)
        ? Math.max(...league.championship_round)
        : league.championship_round
      week = Math.min(
        current_season.week,
        championship_round || current_season.finalWeek
      )
    } else {
      week = Math.min(current_season.week, current_season.finalWeek)
    }
  }

  query.leftJoin('rosters_players', function () {
    this.on('rosters_players.pid', '=', data_view_options.pid_reference)
    this.andOn('rosters_players.season_year', '=', year)
    this.andOn('rosters_players.week', '=', week)
    this.andOn('rosters_players.lid', '=', lid)
  })
}

// `teams` is reached by correlated subquery rather than by a second join in
// `player_league_roster_join`, so adding this column leaves the SQL of every
// existing roster-status view untouched. `teams_pkey` is UNIQUE on (uid, year),
// so the subquery is a single index lookup and cannot fan out a row.
const player_league_fantasy_team_sql = ({ params = {} }) => {
  const year_param = Array.isArray(params.year) ? params.year[0] : params.year
  const year =
    year_param === undefined || year_param === null
      ? current_season.year
      : sql_integer_param({ value: year_param, param_name: 'year' })
  return `(SELECT name FROM teams WHERE uid = rosters_players.tid AND season_year = ${year})`
}

export default {
  ...player_projected_column_definitions,
  ...player_espn_score_column_definitions,
  ...player_betting_market_column_definitions,
  ...player_table_column_definitions,
  ...team_table_column_definitions,
  ...player_league_format_logs_column_definitions,
  ...player_scoring_format_logs_column_definitions,
  ...player_stats_from_plays_column_definitions,
  ...player_fantasy_points_from_plays_column_definitions,
  ...defensive_player_stats_from_plays_column_definitions,
  ...team_stats_from_plays_column_definitions,
  ...player_keeptradecut_column_definitions,
  ...player_games_played_column_definitions,
  ...player_contract_column_definitions,
  ...player_pff_seasonlogs_column_definitions,
  ...player_dfs_salaries_column_definitions,
  ...player_dfs_ownership_column_definitions,
  ...player_rankings_column_definitions,
  ...player_adp_column_definitions,
  ...player_practice_column_definitions,
  ...espn_line_win_rates_column_definitions,
  ...game_column_definitions,
  ...player_snaps_column_definitions,
  ...player_routes_column_definitions,
  ...player_team_column_definition,
  ...team_dvoa_column_definitions,
  ...nfl_team_seasonlogs_column_definitions,
  ...pff_team_grades_column_definitions,
  ...player_pfr_season_value_column_definitions,
  ...player_seasonlogs_column_definitions,
  ...player_extended_salary_column_definitions,
  ...player_extended_salary_over_market_column_definitions,

  player_league_roster_status: {
    table_name: 'rosters_players',
    // This column carries the roster tag in its SELECT list alongside the
    // status, so it discloses the same fact `player_league_roster_tag` does and
    // is gated identically. The raw `rosters_players.tag` integer is never
    // selected -- it would hand the client the tag the label is hiding.
    is_viewer_scoped: true,
    source: { grain: 'player' },
    main_where: () => player_league_roster_status_select,
    main_select: ({ params, data_view_options }) => [
      `${player_league_roster_status_select} AS player_league_roster_status`,
      'rosters_players.slot',
      'rosters_players.tid',
      `${player_league_roster_tag_sql({ params, data_view_options })} AS tag`
    ],
    main_group_by: ({ params, data_view_options }) => [
      'rosters_players.slot',
      'rosters_players.tid',
      player_league_roster_tag_sql({ params, data_view_options })
    ],
    join: player_league_roster_join,
    get_cache_info: create_static_cache_info({
      ttl: 1000 * 60 * 60 * 12 // 12 hours
    })
  },
  // `select_as` plus the `_${column_index}` select alias is what makes sorting
  // resolve: add_sort_clauses looks up `${select_as()}_${column_index}` by
  // position in the SELECT list (get-data-view-results.mjs:2156,2172-2182) and
  // silently falls back to ordering by pid when it cannot find it.
  player_league_roster_tag: {
    table_name: 'rosters_players',
    source: { grain: 'player' },
    is_viewer_scoped: true,
    select_as: () => 'player_league_roster_tag',
    main_where: ({ params, data_view_options }) =>
      player_league_roster_tag_sql({ params, data_view_options }),
    main_select: ({ column_index, params, data_view_options }) => [
      `${player_league_roster_tag_sql({ params, data_view_options })} AS player_league_roster_tag_${column_index}`
    ],
    // Group by the visibility expression rather than `rosters_players.tag`:
    // grouping on the raw tag would keep a hidden restricted free agency tag in
    // its own group, and a row count split on a value the viewer cannot see
    // discloses it.
    main_group_by: ({ params, data_view_options }) => [
      player_league_roster_tag_sql({ params, data_view_options })
    ],
    join: player_league_roster_join,
    get_cache_info: create_static_cache_info({
      ttl: 1000 * 60 * 60 * 12 // 12 hours
    })
  },
  player_league_fantasy_team: {
    table_name: 'rosters_players',
    source: { grain: 'player' },
    select_as: () => 'player_league_fantasy_team',
    // Filters resolve against `rosters_players.tid`, not the displayed name:
    // team names are user-editable and re-keyed per year, so a name predicate
    // stops matching the moment a manager renames. The client sends team ids.
    main_where: () => 'rosters_players.tid',
    main_select: ({ params, column_index }) => [
      `${player_league_fantasy_team_sql({ params })} AS player_league_fantasy_team_${column_index}`
    ],
    main_group_by: ({ params }) => [player_league_fantasy_team_sql({ params })],
    join: player_league_roster_join,
    get_cache_info: create_static_cache_info({
      ttl: 1000 * 60 * 60 * 12 // 12 hours
    })
  },
  player_league_salary: {
    column_name: 'player_salary',
    table_name: 'transactions',
    source: { grain: 'player' },
    table_alias: () => 'latest_transactions',
    select_as: () => 'player_salary',
    main_where: ({ table_name }) => `${table_name}.player_salary`,
    join: ({ query, params = {}, data_view_options = {} }) => {
      const { lid = 1 } = params
      query.leftJoin(
        db('transactions')
          .select('pid')
          .select(db.raw('MAX(occurred_at) as latest_occurred_at'))
          .where('lid', lid)
          .groupBy('pid')
          .as('transactions'),
        'transactions.pid',
        data_view_options.pid_reference
      )
      query.leftJoin('transactions as latest_transactions', function () {
        this.on('latest_transactions.pid', '=', data_view_options.pid_reference)
        this.andOn(
          'latest_transactions.occurred_at',
          '=',
          'transactions.latest_occurred_at'
        )
      })
    },
    get_cache_info: create_static_cache_info({
      ttl: 1000 * 60 * 60 * 12 // 12 hours
    })
  }
}
