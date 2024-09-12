import { constants, bookmaker_constants } from '#libs-shared'
import db from '#db'
import get_join_func from '#libs-server/get-join-func.mjs'
import get_table_hash from '#libs-server/data-views/get-table-hash.mjs'

const get_default_params = ({
  params,
  is_player_game_prop = false,
  is_game_prop = false,
  is_team_game_prop = false
}) => {
  const default_bookmaker = is_team_game_prop
    ? bookmaker_constants.bookmakers.DRAFTKINGS
    : bookmaker_constants.bookmakers.FANDUEL
  const year = Array.isArray(params.year)
    ? params.year[0]
    : params.year || constants.season.year

  let week, market_type

  if (is_game_prop) {
    week = Array.isArray(params.week)
      ? params.week[0]
      : params.week || Math.max(1, constants.season.week)
  } else {
    week = Array.isArray(params.week) ? params.week[0] : params.week || 0
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

  return {
    year,
    week,
    market_type,
    time_type,
    source_id,
    career_year,
    career_game
  }
}

const betting_markets_table_alias = ({
  params = {},
  is_player_game_prop = false,
  base_table_alias = 'betting_markets'
}) => {
  const {
    year,
    week,
    market_type,
    time_type,
    source_id,
    career_year,
    career_game
  } = get_default_params({
    params,
    is_player_game_prop
  })

  return get_table_hash(
    `${base_table_alias}_${year}_week_${week}_source_id_${source_id}_market_type_${market_type}_time_type_${time_type}_career_year_${career_year.join('_')}_career_game_${career_game.join('_')}`
  )
}

const player_betting_market_with = ({
  query,
  params,
  with_table_name,
  having_clauses,
  where_clauses,
  splits,
  select_strings = [],
  is_player_game_prop = false
}) => {
  const {
    year,
    week,
    market_type,
    time_type,
    source_id,
    career_year,
    career_game
  } = get_default_params({
    params,
    is_player_game_prop
  })

  const markets_cte = `${with_table_name}_markets`

  query.with(markets_cte, (qb) => {
    qb.select('source_id', 'source_market_id', 'time_type')
      .from('prop_markets_index')
      .where('market_type', market_type)
      .andWhere('time_type', time_type)
      .andWhere('prop_markets_index.year', year)
      .andWhere('source_id', source_id)

    if (week || career_year.length) {
      qb.join('nfl_games', function () {
        this.on('nfl_games.esbid', '=', 'prop_markets_index.esbid')
        this.andOn('nfl_games.year', '=', 'prop_markets_index.year')
        if (week) {
          this.andOn('nfl_games.week', '=', db.raw('?', [week]))
        }
      })

      if (career_year.length) {
        qb.select('nfl_games.year', 'nfl_games.seas_type')
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

    const unique_select_strings = new Set([
      'pms.selection_pid',
      'pms.selection_metric_line',
      ...select_strings
    ])

    for (const select_string of unique_select_strings) {
      qb.select(db.raw(select_string))
    }

    if (career_year.length) {
      qb.join('player_seasonlogs', function () {
        this.on('pms.selection_pid', '=', 'player_seasonlogs.pid')
          .andOn('m.year', '=', 'player_seasonlogs.year')
          .andOn('m.seas_type', '=', 'player_seasonlogs.seas_type')
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
  params = {}
}) => {
  const join_func = get_join_func(join_type)

  query[join_func](table_name, `${table_name}.selection_pid`, 'player.pid')
}

const team_betting_market_join = ({
  query,
  table_name,
  join_type = 'LEFT',
  params = {}
}) => {
  const join_func = get_join_func(join_type)

  const { market_type } = get_default_params({
    params,
    is_team_game_prop: true,
    is_game_prop: true
  })

  query[join_func](table_name, function () {
    if (
      market_type === bookmaker_constants.team_game_market_types.GAME_SPREAD
    ) {
      this.on(`${table_name}.selection_pid`, '=', 'player.current_nfl_team')
    } else {
      this.on(`${table_name}.h`, '=', 'player.current_nfl_team').orOn(
        `${table_name}.v`,
        '=',
        'player.current_nfl_team'
      )
    }
  })
}

const team_betting_market_with = ({
  query,
  params,
  with_table_name,
  having_clauses,
  where_clauses,
  splits
}) => {
  const { time_type, market_type, source_id, year, week } = get_default_params({
    params,
    is_team_game_prop: true,
    is_game_prop: true
  })

  const markets_cte = `${with_table_name}_markets`

  query.with(markets_cte, (qb) => {
    qb.select(
      'source_id',
      'source_market_id',
      'time_type',
      'nfl_games.h',
      'nfl_games.v'
    )
      .from('prop_markets_index')
      .where('market_type', market_type)
      .andWhere('time_type', time_type)
      .andWhere('prop_markets_index.year', year)
      .andWhere('source_id', source_id)

    if (week) {
      qb.join('nfl_games', function () {
        this.on(`nfl_games.esbid`, '=', `prop_markets_index.esbid`)
        this.andOn(`nfl_games.year`, '=', `prop_markets_index.year`)
        this.andOn(`nfl_games.week`, '=', db.raw('?', [week]))
      })
    }
  })

  query.with(with_table_name, (qb) => {
    qb.select('pms.selection_pid', 'pms.selection_metric_line', 'm.h', 'm.v')
      .from(`${markets_cte} as m`)
      .join('prop_market_selections_index as pms', function () {
        this.on('pms.source_id', '=', 'm.source_id')
          .andOn('pms.source_market_id', '=', 'm.source_market_id')
          .andOn('pms.time_type', '=', 'm.time_type')
      })
  })
}

const team_game_implied_team_total_with = ({
  query,
  params,
  with_table_name,
  having_clauses,
  where_clauses,
  splits
}) => {
  const { time_type, source_id, year, week } = get_default_params({
    params,
    is_team_game_prop: true,
    is_game_prop: true
  })

  const spread_cte = `${with_table_name}_spread`
  const total_cte = `${with_table_name}_total`

  query.with(spread_cte, (qb) => {
    qb.select(
      'prop_markets_index.esbid',
      'pms.selection_pid',
      'pms.selection_metric_line as spread'
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
        this.andOn('nfl_games.year', '=', 'prop_markets_index.year')
      })
      .where(
        'market_type',
        bookmaker_constants.team_game_market_types.GAME_SPREAD
      )
      .andWhere('prop_markets_index.time_type', time_type)
      .andWhere('prop_markets_index.year', year)
      .andWhere('prop_markets_index.source_id', source_id)
      .andWhere('nfl_games.week', week)
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
        this.andOn('nfl_games.year', '=', 'prop_markets_index.year')
      })
      .where(
        'market_type',
        bookmaker_constants.team_game_market_types.GAME_TOTAL
      )
      .andWhere('prop_markets_index.time_type', time_type)
      .andWhere('prop_markets_index.year', year)
      .andWhere('prop_markets_index.source_id', source_id)
      .andWhere('nfl_games.week', week)
  })

  query.with(with_table_name, (qb) => {
    qb.select('s.esbid', 's.selection_pid')
      .from(`${spread_cte} as s`)
      .join(`${total_cte} as t`, 's.esbid', 't.esbid')
      .select(db.raw('(t.total - s.spread) / 2 as implied_team_total'))
  })
}

const team_game_implied_team_total_join = ({
  query,
  table_name,
  join_type = 'LEFT',
  params = {}
}) => {
  const join_func = get_join_func(join_type)

  query[join_func](table_name, function () {
    this.on(`${table_name}.selection_pid`, '=', 'player.current_nfl_team')
  })
}

const create_player_betting_market_field = ({
  column_name,
  column_alias,
  is_player_game_prop,
  select_string,
  with_select_alias
}) => ({
  column_name,
  select_as: () => `${column_alias}_betting_market`,
  with_where: () => select_string || `pms.${column_name}`,
  with_select: () => [
    select_string
      ? `${select_string}${with_select_alias ? ' as ' + with_select_alias : select_string}`
      : `pms.${column_name}`
  ],
  table_alias: (args) =>
    betting_markets_table_alias({ ...args, is_player_game_prop }),
  join: player_betting_market_join,
  with: (args) => player_betting_market_with({ ...args, is_player_game_prop }),
  get_cache_info: ({ params } = {}) => {
    const { year } = get_default_params({
      params,
      is_player_game_prop
    })

    if (year === constants.season.year) {
      return {
        cache_ttl: 1000 * 60 * 60, // 1 hour
        // TODO should expire before the next game starts
        cache_expire_at: null
      }
    } else {
      return {
        cache_ttl: 1000 * 60 * 60 * 24 * 30, // 30 days
        cache_expire_at: null
      }
    }
  }
})

const create_team_betting_market_field = ({ column_name, column_alias }) => ({
  column_name,
  select_as: () => `${column_alias}_betting_market`,
  with_where: ({ table_name }) => `${table_name}.${column_name}`,
  table_alias: (args) =>
    betting_markets_table_alias({
      ...args,
      is_team_game_prop: true,
      is_game_prop: true
    }),
  join: team_betting_market_join,
  with: team_betting_market_with,
  get_cache_info: ({ params } = {}) => {
    const { year } = get_default_params({
      params,
      is_team_game_prop: true,
      is_game_prop: true
    })

    if (year === constants.season.year) {
      return {
        cache_ttl: 1000 * 60 * 60, // 1 hour
        // TODO should expire before the next game starts
        cache_expire_at: null
      }
    } else {
      return {
        cache_ttl: 1000 * 60 * 60 * 24 * 30, // 30 days
        cache_expire_at: null
      }
    }
  }
})

// is_player_game_prop is used to set the default params for the field
export default {
  player_season_prop_line_from_betting_markets:
    create_player_betting_market_field({
      column_name: 'selection_metric_line',
      column_alias: 'season_prop_line',
      is_player_game_prop: false
    }),

  player_game_prop_line_from_betting_markets:
    create_player_betting_market_field({
      column_name: 'selection_metric_line',
      column_alias: 'game_prop_line',
      is_player_game_prop: true
    }),

  player_game_prop_american_odds_from_betting_markets:
    create_player_betting_market_field({
      column_name: 'odds_american',
      column_alias: 'game_prop_american_odds',
      is_player_game_prop: true
    }),

  player_game_prop_decimal_odds_from_betting_markets:
    create_player_betting_market_field({
      column_name: 'odds_decimal',
      column_alias: 'game_prop_decimal_odds',
      is_player_game_prop: true
    }),

  player_game_prop_implied_probability_from_betting_markets:
    create_player_betting_market_field({
      select_string: '1 / odds_decimal',
      with_select_alias: 'game_prop_implied_probability',
      column_name: 'game_prop_implied_probability',
      column_alias: 'game_prop_implied_probability',
      is_player_game_prop: true
    }),

  team_game_prop_line_from_betting_markets: create_team_betting_market_field({
    column_name: 'selection_metric_line',
    column_alias: 'team_game_prop_line'
  }),

  team_game_prop_odds_from_betting_markets: create_team_betting_market_field({
    column_name: 'selection_odds',
    column_alias: 'team_game_prop_odds'
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
        is_game_prop: true,
        base_table_alias: 'team_game_implied_team_total'
      }),
    join: team_game_implied_team_total_join,
    with: team_game_implied_team_total_with
  }
}
