import debug from 'debug'

import db from '#db'
import {
  current_season,
  fantasy_positions,
  external_data_sources,
  league_defaults,
  player_nfl_status
} from '#constants'
import { nfl_week_identifier } from '#libs-shared'
import { season_aggregate_key } from '#libs-shared/calculate-distributional-baselines.mjs'
import get_player_transactions from './get-player-transactions.mjs'
import getLeague from './get-league.mjs'
import apply_practice_current_week_join from './data-views/join-practice-current-week.mjs'
import apply_nfl_games_current_week_join from './data-views/join-nfl-games-current-week.mjs'
import apply_nfl_games_offset_week_join from './data-views/join-nfl-games-offset-week.mjs'

const log = debug('get_players')

// Copy a value onto a payload map only when the database had one. A NULL column
// leaves the key OFF the payload rather than emitting `null`; see the period
// tables' note at the call site for why the difference is load-bearing in the
// SPA.
const assign_if_present = ({ target, key, value }) => {
  if (value === null || value === undefined) return
  target[key] = value
}

export default async function ({
  textSearch,
  teamId,
  leagueId,
  scoring_format_id,
  league_format_id,
  columns = [],
  pids = [],
  include_all_active_players = false,
  season_year = current_season.year
}) {
  const league_roster_player_ids = []

  const projectionLeagueId = leagueId || league_defaults.LEAGUE_ID
  const league = await getLeague({ lid: projectionLeagueId })

  if (!league_format_id) {
    league_format_id = league.league_format_id
  }

  if (!scoring_format_id) {
    scoring_format_id = league.scoring_format_id
  }

  if (teamId) {
    const query = db('rosters_players')
      .where({ tid: teamId, season_year: current_season.year })
      .groupBy(
        'rosters_players.pid',
        'rosters_players.roster_id',
        'rosters_players.tid',
        'rosters_players.lid',
        'rosters_players.week',
        'rosters_players.season_year',
        'rosters_players.slot',
        'rosters_players.player_position',
        'rosters_players.tag',
        'rosters_players.extensions'
      )

    if (pids.length) {
      query.whereIn('rosters_players.pid', pids)
    }

    const playerSlots = await query
    playerSlots.forEach((s) => league_roster_player_ids.push(s.pid))
  } else if (leagueId) {
    const query = db('rosters_players')
      .where({ lid: leagueId, season_year: current_season.year })
      .groupBy(
        'rosters_players.pid',
        'rosters_players.roster_id',
        'rosters_players.tid',
        'rosters_players.lid',
        'rosters_players.week',
        'rosters_players.season_year',
        'rosters_players.slot',
        'rosters_players.player_position',
        'rosters_players.tag',
        'rosters_players.extensions'
      )

    if (pids.length) {
      query.whereIn('rosters_players.pid', pids)
    }

    const playerSlots = await query
    playerSlots.forEach((s) => league_roster_player_ids.push(s.pid))
  }

  const query = db('player')
  apply_practice_current_week_join({ db, query })
  apply_nfl_games_current_week_join({ db, query })

  const reference_params = nfl_week_identifier.reference_week_fallback_params()
  const prior_week_params = reference_params
    ? reference_params.prior_params
    : null
  const fallback_params = reference_params
    ? reference_params.fallback_params
    : null

  if (reference_params) {
    apply_nfl_games_offset_week_join({
      db,
      query,
      offset: -1,
      alias: 'prior_week_game'
    })

    // Reference week: if prior week was a bye, use two-weeks-prior, else prior
    const fallback_week = fallback_params.week
    const fallback_season_year = fallback_params.year
    const fallback_season_type = fallback_params.seas_type

    query.leftJoin('nfl_games as reference_week_game', function () {
      this.on(function () {
        this.on(
          'reference_week_game.home_nfl_team',
          '=',
          'player.current_nfl_team'
        ).orOn(
          'reference_week_game.away_nfl_team',
          '=',
          'player.current_nfl_team'
        )
      })
        .andOn(
          'reference_week_game.week',
          '=',
          db.raw(
            `CASE WHEN prior_week_game.esbid IS NULL THEN ?::int ELSE ?::int END`,
            [fallback_week, prior_week_params.week]
          )
        )
        .andOn(
          'reference_week_game.season_year',
          '=',
          db.raw(
            `CASE WHEN prior_week_game.esbid IS NULL THEN ?::int ELSE ?::int END`,
            [fallback_season_year, prior_week_params.year]
          )
        )
        .andOn(
          'reference_week_game.season_type',
          '=',
          db.raw(
            `CASE WHEN prior_week_game.esbid IS NULL THEN ?::text ELSE ?::text END`,
            [fallback_season_type, prior_week_params.seas_type]
          )
        )
    })
    // Then join to player's gamelog for the reference week game
    query.leftJoin('player_gamelogs as prior_week_gamelog', function () {
      this.on('prior_week_gamelog.pid', '=', 'player.pid').andOn(
        'prior_week_gamelog.esbid',
        '=',
        'reference_week_game.esbid'
      )
    })
  }

  const selects = ['player.pid']

  if (columns.length) {
    for (const column of columns) {
      // TODO check if table needs to be joined
      selects.push(`${column.table_name}.${column.column_name}`)
    }

    query.select(db.raw(selects.join(',')))
    query.groupBy(db.raw(selects.join(',')))
  } else {
    const default_columns = [
      'player.first_name',
      'player.last_name',
      'player.short_name',
      'player.nfl_draft_year',
      'player.college',
      'player.college_division',
      'player.primary_position',
      'player.draft_round',
      'player.current_nfl_team',
      'player.gsis_player_id',
      'player.smart_player_id',
      'player.espn_player_id',
      'player.roster_status',
      'player.game_designation'
    ]

    selects.push(...default_columns)

    query.select(db.raw(selects.join(',')))
    query.groupBy(db.raw(selects.join(',')))

    // Alias practice table columns to avoid overwriting player table values
    // These will be used in the practice_week sub-map, while player values remain at top level
    query.select('practice.game_designation as practice_game_designation')
    query.groupBy('practice.game_designation')

    // Include practice day columns for reserve eligibility checking
    query.select(
      'practice.monday_practice_status',
      'practice.tuesday_practice_status',
      'practice.wednesday_practice_status',
      'practice.thursday_practice_status',
      'practice.friday_practice_status',
      'practice.saturday_practice_status',
      'practice.sunday_practice_status',
      'practice.source_status',
      'practice.roster_status as practice_roster_status'
    )
    query.groupBy(
      'practice.monday_practice_status',
      'practice.tuesday_practice_status',
      'practice.wednesday_practice_status',
      'practice.thursday_practice_status',
      'practice.friday_practice_status',
      'practice.saturday_practice_status',
      'practice.sunday_practice_status',
      'practice.source_status',
      'practice.roster_status'
    )

    query.select('nfl_games.day as game_day')
    query.groupBy('game_day')

    // Calculate prior_week_inactive: true if no gamelog OR gamelog.is_active is false
    // Calculate prior_week_ruled_out: true if gamelog.is_ruled_out_in_game is true
    if (prior_week_params) {
      query.select(
        db.raw(
          'CASE WHEN prior_week_gamelog.pid IS NULL OR prior_week_gamelog.is_active = false THEN true ELSE false END as prior_week_inactive'
        ),
        db.raw(
          'CASE WHEN prior_week_gamelog.is_ruled_out_in_game = true THEN true ELSE false END as prior_week_ruled_out'
        )
      )
      query.groupBy(
        'prior_week_gamelog.pid',
        'prior_week_gamelog.is_active',
        'prior_week_gamelog.is_ruled_out_in_game'
      )
    }
  }

  if (textSearch) {
    query
      .whereRaw(
        "name_search_vector @@ plainto_tsquery('english', ?)",
        textSearch
      )
      .whereIn('player.primary_position', fantasy_positions)
  } else if (pids.length) {
    query.whereIn('player.pid', pids)
  } else if (include_all_active_players) {
    query.orWhere(function () {
      this.whereIn('player.primary_position', fantasy_positions)
        .whereNot('player.current_nfl_team', 'INA')
        .where(function () {
          this.whereNotIn('player.roster_status', [
            player_nfl_status.RETIRED
          ]).orWhereNull('player.roster_status')
        })
    })

    // include rookies during offseason
    if (current_season.week === 0) {
      query.orWhere(function () {
        this.where('player.nfl_draft_year', current_season.year).whereIn(
          'player.primary_position',
          fantasy_positions
        )
      })
    }
  } else if (league_roster_player_ids.length) {
    // only limit to players on league rosters when other conditions are not met
    query.whereIn('player.pid', league_roster_player_ids)
  }

  if (league_format_id) {
    const league_format_player_seasonlogs_selects = [
      'league_format_player_seasonlogs.startable_games',
      'league_format_player_seasonlogs.points_added_earned',
      'league_format_player_seasonlogs.points_added_earned_per_game',
      'league_format_player_seasonlogs.points_added_earned_rank',
      'league_format_player_seasonlogs.points_added_earned_position_rank',
      'league_format_player_seasonlogs.points_added_earned_per_game_rank',
      'league_format_player_seasonlogs.points_added_earned_per_game_position_rank',
      'league_format_player_seasonlogs.points_added_net',
      'league_format_player_seasonlogs.points_added_net_per_game'
    ]
    query
      .leftJoin('league_format_player_seasonlogs', function () {
        this.on('league_format_player_seasonlogs.pid', 'player.pid')
        this.andOn('league_format_player_seasonlogs.season_year', season_year)
        this.andOn(
          db.raw('league_format_player_seasonlogs.league_format_id = ?', [
            league_format_id
          ])
        )
      })
      .select(db.raw(league_format_player_seasonlogs_selects.join(',')))
      .groupBy(db.raw(league_format_player_seasonlogs_selects.join(',')))
  }

  if (scoring_format_id) {
    const scoring_format_player_seasonlogs_selects = [
      'scoring_format_player_seasonlogs.points',
      'scoring_format_player_seasonlogs.points_per_game',
      'scoring_format_player_seasonlogs.points_rank',
      'scoring_format_player_seasonlogs.points_position_rank',
      'scoring_format_player_seasonlogs.points_per_game_rank',
      'scoring_format_player_seasonlogs.points_per_game_position_rank'
    ]

    query
      .leftJoin('scoring_format_player_seasonlogs', function () {
        this.on('scoring_format_player_seasonlogs.pid', 'player.pid')
        this.andOn('scoring_format_player_seasonlogs.season_year', season_year)
        this.andOn(
          db.raw('scoring_format_player_seasonlogs.scoring_format_id = ?', [
            scoring_format_id
          ])
        )
      })
      .select(db.raw(scoring_format_player_seasonlogs_selects.join(',')))
      .groupBy(db.raw(scoring_format_player_seasonlogs_selects.join(',')))
  }

  log(query.toString())
  const player_rows = await query

  const players_by_pid = {}
  for (const player_row of player_rows) {
    // Preserve seasonlog points before overwriting with projection points object
    // The SQL query returns 'points' from scoring_format_player_seasonlogs which would be overwritten
    player_row.seasonlog_points = player_row.points
    player_row.player_salary = null
    player_row.points = {}
    player_row.pts_added = {}
    player_row.projected_points_added_positive_including_cap_savings = {}
    player_row.market_salary = {}
    player_row.projection = {}
    players_by_pid[player_row.pid] = player_row
  }

  const returnedPlayerIds = Object.keys(players_by_pid)
  const playerIdsInLeague = returnedPlayerIds.filter((pid) =>
    league_roster_player_ids.includes(pid)
  )

  if (playerIdsInLeague.length) {
    // include league player salary values
    const playerTransactions = await get_player_transactions({
      lid: leagueId,
      pids: playerIdsInLeague
    })

    for (const tran of playerTransactions) {
      const player_row = player_rows.find((p) => p.pid === tran.pid)
      player_row.player_salary = tran.player_salary
    }
  }

  if (scoring_format_id) {
    // Three periods, three tables, three payload keys. The `points.season` and
    // `points.rest_of_season` keys used to exist only because the per-week table
    // carried '0' and 'ros' in its week column and this loop assigned by that
    // column DYNAMICALLY -- so nothing here ever named them, and repointing the
    // week read alone would have made both keys vanish with no SQL error.
    const weekly_points = await db('scoring_format_player_projection_points')
      .select('pid', 'week', 'projected_points_total as total')
      .where({
        scoring_format_id,
        season_year: current_season.year
      })
      .whereIn('pid', returnedPlayerIds)

    for (const point_projection of weekly_points) {
      players_by_pid[point_projection.pid].points[point_projection.week] =
        point_projection
    }

    const season_points = await db(
      'scoring_format_player_season_projection_points'
    )
      .select('pid', 'projected_points_total as total')
      .where({
        scoring_format_id,
        season_year: current_season.year
      })
      .whereIn('pid', returnedPlayerIds)

    for (const point_projection of season_points) {
      players_by_pid[point_projection.pid].points.season = point_projection
    }

    const rest_of_season_points = await db(
      'scoring_format_player_rest_of_season_projection_points'
    )
      .select('pid', 'projected_points_total as total')
      .where({
        scoring_format_id,
        season_year: current_season.year
      })
      .whereIn('pid', returnedPlayerIds)

    for (const point_projection of rest_of_season_points) {
      players_by_pid[point_projection.pid].points.rest_of_season =
        point_projection
    }
  }

  if (league_format_id) {
    // The variant token appears on exactly the keys that HAVE a variant. A
    // weekly points-added is one signed number, so it carries none; the two
    // period aggregates each publish a positive and a net, and their two market
    // salaries are shares of different POOLS rather than a signed pair.
    //
    // The weekly MARKET SALARY is gone. A price is a season-context quantity --
    // a share of the discretionary cap for the year -- so a per-week one was
    // never a useful number, and it is dropped rather than repointed.
    const weekly_values = await db('league_format_player_projection_values')
      .select('pid', 'week', 'projected_points_added_net')
      .where({
        league_format_id,
        season_year: current_season.year
      })
      .whereIn('pid', returnedPlayerIds)

    for (const { pid, week, projected_points_added_net } of weekly_values) {
      // The COLUMN is projected_points_added_net; the in-memory player property
      // stays `pts_added` -- it is the API shape the SPA reads.
      players_by_pid[pid].pts_added[week] = projected_points_added_net
    }

    const period_tables = [
      {
        table: 'league_format_player_season_projection_values',
        prefix: 'season'
      },
      {
        table: 'league_format_player_rest_of_season_projection_values',
        prefix: 'rest_of_season'
      }
    ]

    for (const { table, prefix } of period_tables) {
      const rows = await db(table)
        .select(
          'pid',
          'projected_points_added_positive',
          'projected_points_added_net',
          'market_salary_positive',
          'market_salary_net'
        )
        .where({
          league_format_id,
          season_year: current_season.year
        })
        .whereIn('pid', returnedPlayerIds)

      for (const row of rows) {
        const player = players_by_pid[row.pid]
        // The BARE period key is the positive variant and `_net` is the signed
        // one, matching the data-view field ids for the same two columns
        // (player_season_projected_points_added and its _net sibling). One
        // convention across every period map means a caller can hold ONE period
        // token and index all of them with it, which is what the SPA's period
        // conditionals do.
        //
        // A NULL column is OMITTED from the payload, never emitted as null. NULL
        // on these tables means the player was never in the drawn pool for that
        // period, and the SPA reads exactly one spelling of that: the sorts on
        // the draft board and the player list use
        // `getIn(['pts_added', <period>], default_points_added)`, whose
        // notSetValue fires on an ABSENT key and not on a present null. Emit the
        // null and Immutable hands the comparator 0, which puts every unprojected
        // player mid-board instead of last -- on both surfaces, with no error
        // anywhere to say the order moved.
        assign_if_present({
          target: player.pts_added,
          key: prefix,
          value: row.projected_points_added_positive
        })
        assign_if_present({
          target: player.pts_added,
          key: `${prefix}_net`,
          value: row.projected_points_added_net
        })
        assign_if_present({
          target: player.market_salary,
          key: prefix,
          value: row.market_salary_positive
        })
        assign_if_present({
          target: player.market_salary,
          key: `${prefix}_net`,
          value: row.market_salary_net
        })
      }
    }
  }

  if (leagueId) {
    // include salary adjusted points added and available-cap market salary.
    // Three periods, three tables, and three named payload keys. The period keys
    // used to be the literal strings '0' and 'ros'; they are named here in the
    // same coordinated deploy that renames them in the SPA, since a bundle
    // reading one vocabulary against a server emitting the other blanks the
    // roster surfaces with no error on either side.
    const leagueValuesProj = await db('league_player_projection_values')
      .where({
        lid: leagueId,
        season_year: current_season.year
      })
      .whereIn('pid', returnedPlayerIds)

    for (const {
      pid,
      week,
      projected_points_added_positive_including_cap_savings
    } of leagueValuesProj) {
      players_by_pid[pid].projected_points_added_positive_including_cap_savings[
        week
      ] = projected_points_added_positive_including_cap_savings
    }

    const league_season_values = await db(
      'league_player_season_projection_values'
    )
      .where({
        lid: leagueId,
        season_year: current_season.year
      })
      .whereIn('pid', returnedPlayerIds)

    for (const {
      pid,
      projected_points_added_positive_including_cap_savings,
      projected_positive_salary_at_available_cap
    } of league_season_values) {
      players_by_pid[
        pid
      ].projected_points_added_positive_including_cap_savings.season =
        projected_points_added_positive_including_cap_savings
      players_by_pid[pid].projected_positive_salary_at_available_cap =
        projected_positive_salary_at_available_cap
    }

    const league_rest_of_season_values = await db(
      'league_player_rest_of_season_projection_values'
    )
      .where({
        lid: leagueId,
        season_year: current_season.year
      })
      .whereIn('pid', returnedPlayerIds)

    for (const {
      pid,
      projected_points_added_positive_including_cap_savings
    } of league_rest_of_season_values) {
      players_by_pid[
        pid
      ].projected_points_added_positive_including_cap_savings.rest_of_season =
        projected_points_added_positive_including_cap_savings
    }
  }

  // include player weekly, season and rest-of-season raw projections
  const projections = await db('projections_index')
    .where('source_id', external_data_sources.AVERAGE)
    .where('season_year', current_season.year)
    .where('week', '>=', current_season.active_fantasy_week)
    .whereIn('pid', returnedPlayerIds)
    // projections data source publishes REG-only; POST projections intentionally omitted
    // (see user:task/league/close-reg-post-week-encoding-gaps.md Out of Scope)
    .where('season_type', 'REG')
  // No week predicate, and none is expressible: `season_projections_index` has
  // no `week` column. That is what makes the season row unreachable by the clock
  // -- the week floor above stepped past 0 in the preseason on 2026-08-04 and
  // amputated every season row, and this query has no equivalent to step.
  const season_projections = await db('season_projections_index')
    .where('source_id', external_data_sources.AVERAGE)
    .where('season_year', current_season.year)
    .whereIn('pid', returnedPlayerIds)
  const rest_of_season_projections = await db('rest_of_season_projections')
    .where('source_id', external_data_sources.AVERAGE)
    .where('season_year', current_season.year)
    .whereIn('pid', returnedPlayerIds)

  for (const projection of projections) {
    players_by_pid[projection.pid].projection[projection.week] = projection
  }

  // Under the named period key, which is the same token the SPA's client-side
  // recompute publishes (app/core/worker/index.js) and the same one the data
  // views and the API payload use.
  for (const season_projection of season_projections) {
    players_by_pid[season_projection.pid].projection[season_aggregate_key] =
      season_projection
  }

  for (const rest_of_season_projection of rest_of_season_projections) {
    players_by_pid[rest_of_season_projection.pid].projection.rest_of_season =
      rest_of_season_projection
  }

  if (
    !include_all_active_players &&
    !textSearch &&
    !pids.length &&
    (teamId || leagueId)
  ) {
    // Both tables accumulate a row per season -- project-lineups deletes and
    // reinserts only the current year -- so without a year predicate the loop
    // below assigns whichever season the scan happens to return last. That is
    // not a tie the newest row wins: the current year's rows are rewritten
    // hourly into freed early pages while a retired season's sit untouched at
    // the end of the heap, so the STALEST season wins and keeps winning. Team 1
    // rendered its 2025 aggregate (starts=1) over a correct 2026 row (starts=16)
    // for exactly this reason.
    const params = leagueId ? { lid: leagueId } : { tid: teamId }
    const contribution_params = {
      ...params,
      season_year: current_season.year
    }
    const contributions = await db('league_team_lineup_contributions').where(
      contribution_params
    )
    const contribution_weeks = await db(
      'league_team_lineup_contribution_weeks'
    ).where(contribution_params)

    for (const player_contribution of contributions) {
      const { pid, starts, starter_plus_points, bench_plus_points } =
        player_contribution
      if (!players_by_pid[pid]) continue

      const player_contribution_weeks = contribution_weeks.filter(
        (w) => w.pid === player_contribution.pid
      )
      const weeks = {}
      for (const {
        week,
        is_starter,
        starter_plus_points,
        bench_plus_points
      } of player_contribution_weeks) {
        weeks[week] = {
          week,
          is_starter,
          starter_plus_points,
          bench_plus_points
        }
      }

      players_by_pid[pid].lineups = {
        starts,
        starter_plus_points,
        bench_plus_points,
        weeks
      }
    }
  }

  return Object.values(players_by_pid)
}
