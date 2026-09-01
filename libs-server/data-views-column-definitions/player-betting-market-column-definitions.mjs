import { bookmaker_constants } from '#libs-shared'
import db from '#db'
import get_join_func from '#libs-server/get-join-func.mjs'
import get_table_hash from '#libs-server/data-views/get-table-hash.mjs'
import { create_betting_cache_info } from '#libs-server/data-views/cache-info-utils.mjs'
import {
  parse_nfl_week_identifier,
  current_nfl_week_params
} from '#libs-shared/nfl-week-identifier.mjs'
import { resolve_single_nfl_week_id_if_explicit } from '#libs-server/data-views/resolve-single-nfl-week-id.mjs'
import {
  resolve_week_scope,
  week_scope_alias_key,
  correlate_week_scoped_cte
} from '#libs-server/data-views/week-scoped-cte.mjs'
import { apply_bridge } from '#libs-server/data-views/identity-bridge-registry.mjs'
import { sql_identifier_param } from '#libs-server/data-views/sanitize-sql-param.mjs'

// The column's GRAIN, derived rather than passed.
//
// This replaces an `is_game_prop` boolean whose name did not describe when it
// was set. It was passed at seven call sites, every one of them a TEAM path;
// no player game-prop path passed it at all. So every player game prop fell
// through to the season branch and resolved week 0 -- measured across four
// clocks, all six player_game_prop_* columns emitted no nfl_games join at any
// of them, in-season REG and POST included. They were season-wide under a
// week-scoped label for their whole lives.
//
// Derived from the two flags that ARE reliably passed, so no call site can omit
// it and there is nothing to keep in sync. A closed set of two full words
// rather than a boolean, because "not a game prop" is a positive thing -- a
// season market -- and not the absence of one.
const resolve_market_grain = ({ is_player_game_prop, is_team_game_prop }) =>
  is_player_game_prop || is_team_game_prop ? 'game' : 'season'

// The weeks a game-grain market CTE spans, and the seasons that list names.
// One resolution shared by the player and team paths, so the two cannot drift
// the way the alias and the CTE did.
//
// Games are filtered by nfl_week_id rather than by a (season_year, season_type,
// week) triple. The triple cannot express a list at all, and its two failure
// modes are both live: POST week 1 and REG week 1 share a (year, week) key --
// production holds 2024 playoff markets sitting on week 1 beside the September
// ones -- and a week list spanning two seasons has no single year to pin. The
// identifier carries all three components, so one IN-list is exact.
//
// A SEASON market carries no week at all, so the week scope is not its to read:
// resolve_week_scope falls back to the current week when a request names none,
// which would narrow a season market to a game. Callers pass is_week_scoped
// false for those and get an empty scope, leaving the scalar-year path in place.
const resolve_market_week_scope = ({
  params,
  data_view_options,
  is_week_scoped = true
}) => {
  if (!is_week_scoped) return { nfl_week_ids: [], market_season_years: [] }

  const { nfl_week_ids } = resolve_week_scope({ params, data_view_options })
  const market_season_years = [
    ...new Set(
      nfl_week_ids
        .map((identifier) => parse_nfl_week_identifier({ identifier }))
        .filter(Boolean)
        .map((parsed) => parsed.year)
    )
  ]

  return { nfl_week_ids, market_season_years }
}

// The player cell maps to a market selection through the TEAM the player was on
// that year, not through player.current_nfl_team -- the current roster
// misattributes every past-season row (a 2024 line would render for the team he
// plays for in 2026, or nothing once the week correlation forces the right year
// and the current team has no market in it). Register the player_year_teams
// bridge the way game_opponent does: it materializes (pid, year, team) from the
// REG gamelogs, and the team joins below reference player_year_teams.team.
//
// The bridge's year is anchored to the season(s) the resolved week scope names,
// so a view-level nfl_week list (no params.year) does not fall back to
// current_season.year. Registration is a no-op once applied (applied_bridges),
// so the first team column in a query wins and the rest reuse the join.
const register_team_attribution_bridge = ({
  data_view_options,
  params,
  market_season_years
}) => {
  const query_context = data_view_options?.query_context
  if (!query_context) return
  apply_bridge({
    query_context,
    from: 'player_year',
    to: 'team_year',
    mode: 'default',
    params: { ...params, year: market_season_years },
    source: null
  })
}

const get_default_params = ({
  params,
  is_player_game_prop = false,
  is_team_game_prop = false
}) => {
  const market_grain = resolve_market_grain({
    is_player_game_prop,
    is_team_game_prop
  })

  const default_bookmaker = is_team_game_prop
    ? bookmaker_constants.bookmakers.DRAFTKINGS
    : bookmaker_constants.bookmakers.FANDUEL

  // Only attach week-scoped prop joins when an explicit week param was set.
  // Empty arrays count as "not set" so season-level prop queries skip the join.
  const resolved_single_nfl_week_id = resolve_single_nfl_week_id_if_explicit({
    params
  })
  const parsed_single = resolved_single_nfl_week_id
    ? parse_nfl_week_identifier({ identifier: resolved_single_nfl_week_id })
    : null

  // ONE resolver for the current week, so year, seas_type and week cannot end
  // up on different tracks. They did: `seas_type` defaulted straight off
  // `current_season.nfl_seas_type` (PRE for six months) while the week came
  // from elsewhere, and clamping that week to 1 pointed every player game-prop
  // column at PRESEASON week 1 -- the d7d3eb421 regression, reverted the same
  // day. Reading both from current_nfl_week_params() is what makes that
  // combination unrepresentable; it always answers on the forward-looking REG
  // track with a week of at least 1.
  //
  // user:guideline/nfl/league/nfl-week-encoding.md forbids a column definition
  // branching on nfl_seas_type directly, and this was the last site doing it.
  const current_week_params = current_nfl_week_params()

  const year = parsed_single
    ? parsed_single.year
    : Array.isArray(params.year)
      ? params.year[0]
      : params.year || current_week_params.year
  const seas_type = parsed_single
    ? parsed_single.seas_type
    : Array.isArray(params.seas_type)
      ? params.seas_type[0]
      : params.seas_type || current_week_params.seas_type

  // hit_type and historical_range are concatenated into the column NAME by the
  // historical_* builders below, so they land in identifier position where no
  // quoting applies. Validate the lowercased form that actually reaches SQL.
  const hit_type = sql_identifier_param({
    value: (Array.isArray(params.hit_type)
      ? params.hit_type[0] || 'hard'
      : params.hit_type || 'hard'
    ).toLowerCase(),
    param_name: 'hit_type'
  })

  const historical_range = sql_identifier_param({
    value: (Array.isArray(params.historical_range)
      ? params.historical_range[0] || 'current_season'
      : params.historical_range || 'current_season'
    ).toLowerCase(),
    param_name: 'historical_range'
  })

  let week, market_type

  // A week param holds a real week or NOTHING. Never 0.
  //
  // 0 was doing double duty as "the whole season", which is falsy, so it broke
  // every `if (week)` guard it reached -- including the nfl_games join gate
  // below, which is how a season-grain column and a game-grain column with no
  // resolvable week became indistinguishable. `null` is not a week a predicate
  // can silently match, and the grain the column DECLARES is what the gate now
  // tests.
  //
  // The game branch no longer falls back to current_season.nfl_seas_week, which
  // is 0 at 2026-07-01 and would skip the join outright.
  const explicit_week = Array.isArray(params.week)
    ? params.week[0]
    : params.week

  if (parsed_single) {
    week = parsed_single.week
  } else if (market_grain === 'season') {
    week = null
  } else {
    week = explicit_week || current_week_params.week
  }

  if (is_player_game_prop) {
    market_type = Array.isArray(params.market_type)
      ? params.market_type[0]
      : params.market_type ||
        bookmaker_constants.player_prop_types.GAME_PASSING_YARDS
  } else if (is_team_game_prop) {
    market_type = Array.isArray(params.market_type)
      ? params.market_type[0]
      : params.market_type ||
        bookmaker_constants.team_game_market_types.GAME_TOTAL
  } else {
    market_type = Array.isArray(params.market_type)
      ? params.market_type[0]
      : params.market_type ||
        bookmaker_constants.player_prop_types.SEASON_PASSING_YARDS
  }

  const time_type = Array.isArray(params.time_type)
    ? params.time_type[0]
    : params.time_type || bookmaker_constants.time_type.CLOSE
  const source_id = Array.isArray(params.source_id)
    ? params.source_id[0]
    : params.source_id || default_bookmaker

  let career_year = params.career_year || []
  if (!Array.isArray(career_year)) {
    career_year = [career_year]
  }

  let career_game = params.career_game || []
  if (!Array.isArray(career_game)) {
    career_game = [career_game]
  }

  // Use explicit selection_type if provided, otherwise default to OVER
  let selection_type
  if (params.selection_type !== undefined && params.selection_type !== null) {
    selection_type = params.selection_type
    if (!Array.isArray(selection_type)) {
      selection_type = [selection_type]
    }
  } else {
    selection_type = [bookmaker_constants.selection_type.OVER]
  }

  return {
    year,
    week,
    market_grain,
    seas_type,
    market_type,
    time_type,
    source_id,
    career_year,
    career_game,
    selection_type,
    hit_type,
    historical_range
  }
}

// The CTE name, and with it the cache key. It must resolve its params under the
// SAME grain as the `with` that builds the CTE, which it did not: this function
// destructured only `is_player_game_prop` and silently dropped
// `is_team_game_prop`, so the four team game-prop columns hashed at the season
// grain while team_betting_market_with built a game-grain CTE. Measured before
// the fix: identical alias at week 6 and week 7, with an explicit week moving
// the hash as the control -- two different weeks sharing one cache key.
const betting_markets_table_alias = ({
  params = {},
  is_player_game_prop = false,
  is_team_game_prop = false,
  base_table_alias = 'betting_markets'
}) => {
  const {
    year,
    week,
    market_grain,
    seas_type,
    market_type,
    time_type,
    source_id,
    career_year,
    career_game,
    selection_type
  } = get_default_params({
    params,
    is_player_game_prop,
    is_team_game_prop
  })

  // A game-grain alias hashes the FULL requested week list, not the single week
  // a pinned CTE ends up holding. Hashing the collapsed week is what lets two
  // columns naming different week lists share one join group and render one
  // another's data; see week-scoped-cte.mjs for why the finer key is the safe
  // direction. A season market has no week and keeps the shape it had.
  const week_key =
    market_grain === 'game'
      ? `weeks_${week_scope_alias_key({ params })}`
      : `seas_type_${seas_type}_week_${week}`

  return get_table_hash(
    `${base_table_alias}_${year}_${week_key}_source_id_${source_id}_market_type_${market_type}_time_type_${time_type}_career_year_${career_year.join('_')}_career_game_${career_game.join('_')}_selection_type_${selection_type.join('_')}`
  )
}

const player_betting_market_with = ({
  query,
  params,
  with_table_name,
  having_clauses,
  where_clauses,
  row_axes,
  select_strings = [],
  is_player_game_prop = false,
  data_view_options
}) => {
  const {
    year,
    week,
    market_grain,
    seas_type,
    market_type,
    time_type,
    source_id,
    career_year,
    career_game,
    selection_type
  } = get_default_params({
    params,
    is_player_game_prop
  })

  const is_week_scoped = market_grain === 'game'

  // The weeks this CTE spans. Resolved through the same helper the join reads,
  // so a CTE cannot hold weeks the join has no predicate to select between --
  // which fans a week cell into one row per week.
  const { nfl_week_ids, market_season_years } = resolve_market_week_scope({
    params,
    data_view_options,
    is_week_scoped
  })

  const markets_cte = `${with_table_name}_markets`

  query.with(markets_cte, (qb) => {
    qb.select('source_id', 'source_market_id', 'time_type')
      .from('prop_markets_index')
      .where('market_type', market_type)
      .andWhere('time_type', time_type)

    // A week list can name several seasons, which a scalar year cannot hold.
    if (market_season_years.length) {
      qb.whereIn('prop_markets_index.season_year', market_season_years)
    } else {
      qb.andWhere('prop_markets_index.season_year', year)
    }

    qb.andWhere('source_id', source_id)

    if (is_week_scoped) {
      qb.select('nfl_games.season_year as year', 'nfl_games.week as week')
    }

    // The career_game join below correlates on m.esbid, so the CTE has to
    // carry it.
    if (career_game.length) {
      qb.select('prop_markets_index.esbid')
    }

    // Tests the grain the column DECLARES, not the truthiness of an integer.
    // `if (week)` was the gate, so a falsy 0 silently turned a game-scoped
    // column into a season-wide one -- and clamping that 0 to 1 turned it into
    // a PRESEASON-week-1 inner join that dropped every player without a PRE-1
    // game. Both readings came from the same expression.
    if (market_grain === 'game' || career_year.length) {
      qb.join('nfl_games', function () {
        this.on('nfl_games.esbid', '=', 'prop_markets_index.esbid')
        this.andOn(
          'nfl_games.season_year',
          '=',
          'prop_markets_index.season_year'
        )
        if (is_week_scoped) {
          this.andOn(
            db.raw(
              `nfl_games.nfl_week_id in (${nfl_week_ids.map(() => '?').join(', ')})`,
              nfl_week_ids
            )
          )
        } else {
          this.andOn('nfl_games.season_type', '=', db.raw('?', [seas_type]))
          if (week) {
            this.andOn('nfl_games.week', '=', db.raw('?', [week]))
          }
        }
      })

      if (career_year.length) {
        qb.select('nfl_games.season_year', 'nfl_games.season_type')
      }
    }
  })

  query.with(with_table_name, (qb) => {
    qb.from(`${markets_cte} as m`).join(
      'prop_market_selections_index as pms',
      function () {
        this.on('pms.source_id', '=', 'm.source_id')
          .andOn('pms.source_market_id', '=', 'm.source_market_id')
          .andOn('pms.time_type', '=', 'm.time_type')
      }
    )

    if (selection_type.length) {
      qb.whereIn('pms.selection_type', selection_type)
    }

    const unique_select_strings = new Set([
      'pms.selection_pid',
      'pms.selection_metric_line',
      ...select_strings
    ])

    for (const select_string of unique_select_strings) {
      qb.select(db.raw(select_string))
    }

    if (is_week_scoped) {
      qb.select('m.year', 'm.week')

      // One row per player per week, or the LEFT JOIN multiplies the cell. A
      // book listing the same player twice for one game is not hypothetical:
      // 49 (pid, nfl_week_id, market_type) groups since 2023 carry two FanDuel
      // CLOSE OVER selections, and a pinned single-week CTE has always fanned
      // those cells out too. Newest observation wins, ties broken on
      // source_market_id so the choice is deterministic rather than
      // plan-dependent.
      //
      // DISTINCT ON rather than a grouped self-join deliberately: the self-join
      // shape is what cost player_dfs_salary a 212x plan regression, because
      // the planner treats its perfectly-correlated keys as independent and
      // collapses the row estimate to 1.
      qb.distinctOn('pms.selection_pid', 'm.year', 'm.week').orderBy([
        { column: 'pms.selection_pid' },
        { column: 'm.year' },
        { column: 'm.week' },
        { column: 'pms.observed_at', order: 'desc' },
        { column: 'm.source_market_id' }
      ])
    }

    if (career_year.length) {
      qb.join('player_seasonlogs', function () {
        this.on('pms.selection_pid', '=', 'player_seasonlogs.pid')
          .andOn('m.season_year', '=', 'player_seasonlogs.season_year')
          .andOn('m.season_type', '=', 'player_seasonlogs.season_type')
      })
      qb.whereBetween('player_seasonlogs.career_year', [
        Math.min(career_year[0], career_year[1]),
        Math.max(career_year[0], career_year[1])
      ])
    }

    if (career_game.length) {
      qb.join('player_gamelogs', function () {
        this.on('pms.selection_pid', '=', 'player_gamelogs.pid').andOn(
          'm.esbid',
          '=',
          'player_gamelogs.esbid'
        )
      })
      qb.whereBetween('player_gamelogs.career_game', [
        Math.min(career_game[0], career_game[1]),
        Math.max(career_game[0], career_game[1])
      ])
    }

    if (having_clauses) {
      for (const having_clause of having_clauses) {
        qb.havingRaw(having_clause)
      }
    }

    if (where_clauses) {
      for (const where_clause of where_clauses) {
        qb.whereRaw(where_clause)
      }
    }
  })
}

const player_betting_market_join = ({
  query,
  table_name,
  join_type = 'LEFT',
  params = {},
  data_view_options = {}
}) => {
  const join_func = get_join_func(join_type)

  query[join_func](table_name, function () {
    this.on(`${table_name}.selection_pid`, '=', data_view_options.pid_reference)

    // Under a week axis the CTE holds every requested week, so the cell's own
    // year and week are what select the row. Without this the join was on the
    // player alone and one week's line rendered on every week row.
    correlate_week_scoped_cte({
      builder: this,
      db,
      cte_name: table_name,
      data_view_options
    })
  })
}

const team_betting_market_join = ({
  query,
  table_name,
  join_type = 'LEFT',
  params = {},
  data_view_options = {}
}) => {
  const join_func = get_join_func(join_type)

  const { market_type } = get_default_params({
    params,
    is_team_game_prop: true
  })

  query[join_func](table_name, function () {
    // The player's team for the cell's year, not player.current_nfl_team: a
    // team-game market selection is keyed by the team that played in the game,
    // and the current roster is the wrong team for any past-season row. The
    // bridge (player_year_teams) is registered by the with builder.
    const team_reference = 'player_year_teams.team'

    if (
      market_type === bookmaker_constants.team_game_market_types.GAME_SPREAD ||
      market_type === bookmaker_constants.team_game_market_types.GAME_ALT_SPREAD
    ) {
      this.on(`${table_name}.selection_pid`, '=', team_reference)
    } else {
      // Parenthesised, or the week predicate below would bind to the OR's
      // right arm alone and the away-team branch would match every week.
      this.on(function () {
        this.on(`${table_name}.home_nfl_team`, '=', team_reference).orOn(
          `${table_name}.away_nfl_team`,
          '=',
          team_reference
        )
      })
    }

    // Under a week axis the CTE holds every requested week, so the cell's own
    // year and week are what select the row. Without this the join was on the
    // team alone and one week's line rendered on every week row.
    correlate_week_scoped_cte({
      builder: this,
      db,
      cte_name: table_name,
      data_view_options
    })
  })
}

const team_betting_market_with = ({
  query,
  params,
  with_table_name,
  select_strings = [],
  having_clauses,
  where_clauses,
  row_axes,
  data_view_options
}) => {
  const {
    time_type,
    market_type,
    source_id,
    year,
    week,
    seas_type,
    selection_type
  } = get_default_params({
    params,
    is_team_game_prop: true
  })

  // The weeks this CTE spans, resolved through the same helper the join reads.
  const { nfl_week_ids, market_season_years } = resolve_market_week_scope({
    params,
    data_view_options
  })

  // The player maps to the market through the team he was on that year
  // (player_year_teams.team), so the bridge must be in the query before the
  // join below references it.
  register_team_attribution_bridge({
    data_view_options,
    params,
    market_season_years
  })

  const markets_cte = `${with_table_name}_markets`

  query.with(markets_cte, (qb) => {
    qb.select(
      'source_id',
      'source_market_id',
      'time_type',
      'nfl_games.home_nfl_team',
      'nfl_games.away_nfl_team',
      'nfl_games.season_year as year',
      'nfl_games.week as week'
    )
      .from('prop_markets_index')
      .where('market_type', market_type)
      .andWhere('time_type', time_type)
      .andWhere('source_id', source_id)

    // A week list can name several seasons, which a scalar year cannot hold.
    if (market_season_years.length) {
      qb.whereIn('prop_markets_index.season_year', market_season_years)
    } else {
      qb.andWhere('prop_markets_index.season_year', year)
    }

    // home_nfl_team/away_nfl_team are projected unconditionally above (and read
    // as m.home_nfl_team/m.away_nfl_team downstream), so nfl_games must always
    // be joined; only the week narrowing is conditional.
    qb.join('nfl_games', function () {
      this.on(`nfl_games.esbid`, '=', `prop_markets_index.esbid`)
      this.andOn(`nfl_games.season_year`, '=', `prop_markets_index.season_year`)
      if (nfl_week_ids.length) {
        // By nfl_week_id rather than a (season_year, season_type, week)
        // triple: the triple cannot express a list, and POST week 1 collides
        // with REG week 1 -- production holds 2024 playoff markets on week 1
        // beside the September ones.
        this.andOn(
          db.raw(
            `nfl_games.nfl_week_id in (${nfl_week_ids.map(() => '?').join(', ')})`,
            nfl_week_ids
          )
        )
      } else if (week) {
        this.andOn(`nfl_games.week`, '=', db.raw('?', [week]))
        this.andOn(`nfl_games.season_type`, '=', db.raw('?', [seas_type]))
      }
    })
  })

  query.with(with_table_name, (qb) => {
    qb.select(
      'pms.selection_pid',
      'm.home_nfl_team',
      'm.away_nfl_team',
      'm.year',
      'm.week'
    )
      .from(`${markets_cte} as m`)
      .join('prop_market_selections_index as pms', function () {
        this.on('pms.source_id', '=', 'm.source_id')
          .andOn('pms.source_market_id', '=', 'm.source_market_id')
          .andOn('pms.time_type', '=', 'm.time_type')
      })

    if (selection_type.length) {
      qb.whereIn('pms.selection_type', selection_type)
    }

    // Add any additional select strings
    for (const select_string of select_strings) {
      qb.select(db.raw(select_string))
    }

    // Add any having clauses
    if (having_clauses) {
      for (const having_clause of having_clauses) {
        qb.havingRaw(having_clause)
      }
    }

    // Add any where clauses
    if (where_clauses) {
      for (const where_clause of where_clauses) {
        qb.whereRaw(where_clause)
      }
    }
  })
}

const team_game_implied_team_total_with = ({
  query,
  params,
  with_table_name,
  having_clauses,
  where_clauses,
  row_axes,
  data_view_options
}) => {
  const { time_type, source_id, year, week, seas_type } = get_default_params({
    params,
    is_team_game_prop: true
  })

  const { nfl_week_ids, market_season_years } = resolve_market_week_scope({
    params,
    data_view_options
  })

  // Both halves scan the same games, so the year and week narrowing is written
  // once and applied to each. Divergence here is the class this whole migration
  // exists to close.
  const apply_market_scope = (qb) => {
    if (market_season_years.length) {
      qb.whereIn('prop_markets_index.season_year', market_season_years)
    } else {
      qb.andWhere('prop_markets_index.season_year', year)
    }

    if (nfl_week_ids.length) {
      qb.whereIn('nfl_games.nfl_week_id', nfl_week_ids)
    } else {
      qb.andWhere('nfl_games.week', week)
      qb.andWhere('nfl_games.season_type', db.raw('?', [seas_type]))
    }
  }

  // The player maps to the market through the team he was on that year
  // (player_year_teams.team), so the bridge must be in the query before the
  // join below references it.
  register_team_attribution_bridge({
    data_view_options,
    params,
    market_season_years
  })

  const spread_cte = `${with_table_name}_spread`
  const total_cte = `${with_table_name}_total`

  query.with(spread_cte, (qb) => {
    qb.select(
      'prop_markets_index.esbid',
      'pms.selection_pid',
      'pms.selection_metric_line as spread',
      'nfl_games.season_year as year',
      'nfl_games.week as week'
    )
      .from('prop_markets_index')
      .join('prop_market_selections_index as pms', function () {
        this.on('pms.source_id', '=', 'prop_markets_index.source_id')
          .andOn(
            'pms.source_market_id',
            '=',
            'prop_markets_index.source_market_id'
          )
          .andOn('pms.time_type', '=', 'prop_markets_index.time_type')
      })
      .join('nfl_games', function () {
        this.on('nfl_games.esbid', '=', 'prop_markets_index.esbid')
        this.andOn(
          'nfl_games.season_year',
          '=',
          'prop_markets_index.season_year'
        )
      })
      .where(
        'market_type',
        bookmaker_constants.team_game_market_types.GAME_SPREAD
      )
      .andWhere('prop_markets_index.time_type', time_type)
      .andWhere('prop_markets_index.source_id', source_id)

    apply_market_scope(qb)
  })

  query.with(total_cte, (qb) => {
    qb.select('prop_markets_index.esbid', 'pms.selection_metric_line as total')
      .from('prop_markets_index')
      .join('prop_market_selections_index as pms', function () {
        this.on('pms.source_id', '=', 'prop_markets_index.source_id')
          .andOn(
            'pms.source_market_id',
            '=',
            'prop_markets_index.source_market_id'
          )
          .andOn('pms.time_type', '=', 'prop_markets_index.time_type')
      })
      .join('nfl_games', function () {
        this.on('nfl_games.esbid', '=', 'prop_markets_index.esbid')
        this.andOn(
          'nfl_games.season_year',
          '=',
          'prop_markets_index.season_year'
        )
      })
      .where(
        'market_type',
        bookmaker_constants.team_game_market_types.GAME_TOTAL
      )
      .andWhere('prop_markets_index.time_type', time_type)
      .andWhere('prop_markets_index.source_id', source_id)

    apply_market_scope(qb)
  })

  query.with(with_table_name, (qb) => {
    // year and week ride out of the spread half; the total half is joined on
    // esbid, which already fixes the game and therefore the week.
    qb.select('s.esbid', 's.selection_pid', 's.year', 's.week')
      .from(`${spread_cte} as s`)
      .join(`${total_cte} as t`, 's.esbid', 't.esbid')
      .select(db.raw('(t.total - s.spread) / 2 as implied_team_total'))
  })
}

const team_game_implied_team_total_join = ({
  query,
  table_name,
  join_type = 'LEFT',
  params = {},
  data_view_options = {}
}) => {
  const join_func = get_join_func(join_type)

  query[join_func](table_name, function () {
    // Same attribution rule as team_betting_market_join: the team for the
    // cell's year, supplied by the player_year_teams bridge registered in the
    // with builder above.
    this.on(`${table_name}.selection_pid`, '=', 'player_year_teams.team')

    // Under a week axis the CTE holds every requested week, so the cell's own
    // year and week are what select the row. Without this the join was on the
    // team alone and one week's implied total rendered on every week row.
    correlate_week_scoped_cte({
      builder: this,
      db,
      cte_name: table_name,
      data_view_options
    })
  })
}

const create_player_betting_market_field = ({
  column_name,
  column_alias,
  is_player_game_prop,
  select_string,
  with_select_alias,
  with_select,
  with_where,
  main_select,
  main_group_by
}) => ({
  column_name,
  main_select,
  main_group_by,
  select_as: () => column_alias,
  with_where: with_where || (() => select_string || `pms.${column_name}`),
  with_select:
    with_select ||
    (() => [
      select_string
        ? `${select_string}${with_select_alias ? ' as ' + with_select_alias : select_string}`
        : `pms.${column_name}`
    ]),
  table_alias: (args) =>
    betting_markets_table_alias({ ...args, is_player_game_prop }),
  join: player_betting_market_join,
  with: (args) => player_betting_market_with({ ...args, is_player_game_prop }),
  source: { grain: 'player' },
  get_cache_info: create_betting_cache_info({
    get_params: ({ params = {} } = {}) => {
      const { year, week } = get_default_params({
        params,
        is_player_game_prop
      })
      return { year: [year], week: week ? [week] : [] }
    }
  })
})

const create_team_betting_market_field = ({ column_name, column_alias }) => ({
  column_name,
  select_as: () => column_alias,
  with_select: () => [`pms.${column_name}`],
  with_where: ({ table_name }) => `${table_name}.${column_name}`,
  table_alias: (args) =>
    betting_markets_table_alias({
      ...args,
      is_team_game_prop: true
    }),
  join: team_betting_market_join,
  with: team_betting_market_with,
  source: { grain: 'player' },
  get_cache_info: create_betting_cache_info({
    get_params: ({ params = {} } = {}) => {
      const { year, week } = get_default_params({
        params,
        is_team_game_prop: true
      })
      return { year: [year], week: week ? [week] : [] }
    }
  })
})

const historical_main_select = ({
  table_name,
  params,
  field_type,
  column_index
}) => {
  const { hit_type, historical_range } = get_default_params({
    params,
    is_player_game_prop: true
  })
  return [
    `${table_name}.${historical_range}_${field_type}_${hit_type} as prop_historical_${field_type}_${column_index}`
  ]
}

const historical_main_group_by = ({ table_name, params, field_type }) => {
  const { hit_type, historical_range } = get_default_params({
    params,
    is_player_game_prop: true
  })
  return [`${table_name}.${historical_range}_${field_type}_${hit_type}`]
}

const historical_with = ({ params, field_type }) => {
  const { hit_type, historical_range } = get_default_params({
    params,
    is_player_game_prop: true
  })
  return [`pms.${historical_range}_${field_type}_${hit_type}`]
}

const create_historical_field = (field_type) =>
  create_player_betting_market_field({
    column_alias: `prop_historical_${field_type}`,
    main_select: (args) => historical_main_select({ ...args, field_type }),
    main_group_by: (args) => historical_main_group_by({ ...args, field_type }),
    is_player_game_prop: true,
    with_select: (args) => historical_with({ ...args, field_type }),
    with_where: (args) => historical_with({ ...args, field_type })
  })

// is_player_game_prop is used to set the default params for the field
export default {
  player_season_prop_line_from_betting_markets:
    create_player_betting_market_field({
      column_name: 'selection_metric_line',
      column_alias: 'season_prop_line_betting_market',
      is_player_game_prop: false
    }),

  player_game_prop_line_from_betting_markets:
    create_player_betting_market_field({
      column_name: 'selection_metric_line',
      column_alias: 'game_prop_line_betting_market',
      is_player_game_prop: true
    }),

  player_game_prop_american_odds_from_betting_markets:
    create_player_betting_market_field({
      column_name: 'odds_american',
      column_alias: 'game_prop_american_odds_betting_market',
      is_player_game_prop: true
    }),

  player_game_prop_decimal_odds_from_betting_markets:
    create_player_betting_market_field({
      column_name: 'odds_decimal',
      column_alias: 'game_prop_decimal_odds_betting_market',
      is_player_game_prop: true
    }),

  player_game_prop_implied_probability_from_betting_markets:
    create_player_betting_market_field({
      select_string: '1 / odds_decimal',
      with_select_alias: 'game_prop_implied_probability',
      column_name: 'game_prop_implied_probability',
      column_alias: 'game_prop_implied_probability_betting_market',
      is_player_game_prop: true
    }),

  player_game_prop_historical_hit_rate: create_historical_field('hit_rate'),
  player_game_prop_historical_edge: create_historical_field('edge'),

  team_game_prop_line_from_betting_markets: create_team_betting_market_field({
    column_name: 'selection_metric_line',
    column_alias: 'team_game_prop_line_betting_market'
  }),

  team_game_prop_american_odds_from_betting_markets:
    create_team_betting_market_field({
      column_name: 'odds_american',
      column_alias: 'team_game_prop_american_odds_betting_market'
    }),

  team_game_prop_decimal_odds_from_betting_markets:
    create_team_betting_market_field({
      column_name: 'odds_decimal',
      column_alias: 'team_game_prop_decimal_odds_betting_market'
    }),

  team_game_implied_team_total_from_betting_markets: {
    column_name: 'implied_team_total',
    select_as: () => 'team_game_implied_team_total_betting_market',
    with_where: ({ table_name }) =>
      `CASE WHEN player.current_nfl_team = ${table_name}.h THEN ${table_name}.home_implied_total ELSE ${table_name}.away_implied_total END`,
    table_alias: (args) =>
      betting_markets_table_alias({
        ...args,
        is_team_game_prop: true,
        base_table_alias: 'team_game_implied_team_total'
      }),
    join: team_game_implied_team_total_join,
    with: team_game_implied_team_total_with,
    source: { grain: 'player' },
    get_cache_info: create_betting_cache_info({
      get_params: ({ params = {} } = {}) => {
        const { year, week } = get_default_params({
          params,
          is_team_game_prop: true
        })
        return { year: [year], week: week ? [week] : [] }
      }
    })
  }
}
