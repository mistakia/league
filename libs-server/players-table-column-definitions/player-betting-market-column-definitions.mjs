import { constants, bookmaker_constants } from '#libs-shared'
import db from '#db'
import get_join_func from '#libs-server/get-join-func.mjs'
import get_table_hash from '#libs-server/get-table-hash.mjs'

const betting_markets_table_alias = ({ params = {} }) => {
  const year = Array.isArray(params.year)
    ? params.year[0]
    : params.year || constants.season.year
  const week = Array.isArray(params.week)
    ? params.week[0]
    : params.week || constants.season.week
  const source_id = Array.isArray(params.source_id)
    ? params.source_id[0]
    : params.source_id || bookmaker_constants.bookmakers.FANDUEL
  const time_type = Array.isArray(params.time_type)
    ? params.time_type[0]
    : params.time_type || bookmaker_constants.time_type.CLOSE
  const market_type = Array.isArray(params.market_type)
    ? params.market_type[0]
    : params.market_type ||
      bookmaker_constants.player_prop_types.SEASON_PASSING_YARDS

  return get_table_hash(
    `betting_markets_${year}_week_${week}_source_id_${source_id}_market_type_${market_type}_time_type_${time_type}`
  )
}

const player_betting_market_with = ({
  query,
  params,
  with_table_name,
  having_clauses,
  where_clauses,
  splits
}) => {
  const time_type = Array.isArray(params.time_type)
    ? params.time_type[0]
    : params.time_type || bookmaker_constants.time_type.CLOSE
  const market_type = Array.isArray(params.market_type)
    ? params.market_type[0]
    : params.market_type ||
      bookmaker_constants.player_prop_types.SEASON_PASSING_YARDS
  const source_id = Array.isArray(params.source_id)
    ? params.source_id[0]
    : params.source_id || bookmaker_constants.bookmakers.FANDUEL

  const year = Array.isArray(params.year)
    ? params.year[0]
    : params.year || constants.season.year
  let week = Array.isArray(params.week) ? params.week[0] : params.week

  if (bookmaker_constants.player_game_prop_types[market_type] && !week) {
    week = Math.max(1, constants.season.week)
  }

  const markets_cte = `${with_table_name}_markets`

  query.with(markets_cte, (qb) => {
    qb.select('source_id', 'source_market_id', 'time_type')
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
    qb.select('pms.selection_pid', 'pms.selection_metric_line')
      .from(`${markets_cte} as m`)
      .join('prop_market_selections_index as pms', function () {
        this.on('pms.source_id', '=', 'm.source_id')
          .andOn('pms.source_market_id', '=', 'm.source_market_id')
          .andOn('pms.time_type', '=', 'm.time_type')
      })

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

  query[join_func](table_name, function () {
    this.on(`${table_name}.h`, '=', 'player.current_nfl_team').orOn(
      `${table_name}.v`,
      '=',
      'player.current_nfl_team'
    )
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
  const time_type = Array.isArray(params.time_type)
    ? params.time_type[0]
    : params.time_type || bookmaker_constants.time_type.CLOSE
  const market_type = Array.isArray(params.market_type)
    ? params.market_type[0]
    : params.market_type || bookmaker_constants.game_market_types.GAME_TOTAL
  const source_id = Array.isArray(params.source_id)
    ? params.source_id[0]
    : params.source_id || bookmaker_constants.bookmakers.DRAFTKINGS

  const year = Array.isArray(params.year)
    ? params.year[0]
    : params.year || constants.season.year
  let week = Array.isArray(params.week) ? params.week[0] : params.week

  if (!week) {
    week = Math.max(1, constants.season.week)
  }

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

const create_player_betting_market_field = ({ column_name, column_alias }) => ({
  column_name,
  select_as: () => `${column_alias}_betting_market`,
  with_where: () => `pms.${column_name}`,
  table_alias: betting_markets_table_alias,
  join: player_betting_market_join,
  with: player_betting_market_with
})

const create_team_betting_market_field = ({ column_name, column_alias }) => ({
  column_name,
  select_as: () => `${column_alias}_betting_market`,
  with_where: ({ table_name }) => `${table_name}.${column_name}`,
  table_alias: betting_markets_table_alias,
  join: team_betting_market_join,
  with: team_betting_market_with
})

export default {
  player_season_prop_line_from_betting_markets:
    create_player_betting_market_field({
      column_name: 'selection_metric_line',
      column_alias: 'season_prop_line'
    }),

  player_game_prop_line_from_betting_markets:
    create_player_betting_market_field({
      column_name: 'selection_metric_line',
      column_alias: 'game_prop_line'
    }),

  team_game_prop_line_from_betting_markets: create_team_betting_market_field({
    column_name: 'selection_metric_line',
    column_alias: 'game_prop_line'
  }),

  team_game_prop_odds_from_betting_markets: create_team_betting_market_field({
    column_name: 'selection_odds',
    column_alias: 'game_prop_odds'
  })
}
