import get_table_hash from '#libs-server/data-views/get-table-hash.mjs'
import get_play_by_play_default_params from '#libs-server/data-views/get-play-by-play-default-params.mjs'
import db from '#db'

const get_default_params = ({ params = {} } = {}) => {
  let year = params.year || []
  if (!Array.isArray(year)) {
    year = [year]
  }

  let week = params.week || []
  if (!Array.isArray(week)) {
    week = [week]
  }

  let year_offset = params.year_offset || []
  if (!Array.isArray(year_offset)) {
    year_offset = [year_offset]
  }

  let career_year = params.career_year || []
  if (!Array.isArray(career_year)) {
    career_year = [career_year]
  }

  let career_game = params.career_game || []
  if (!Array.isArray(career_game)) {
    career_game = [career_game]
  }

  const adjusted_years = year.flatMap((y) => {
    const base_year = Number(y)
    if (year_offset.length === 2) {
      // If year_offset is a range
      const max_offset = Math.max(...year_offset.map(Number))
      const min_offset = Math.min(...year_offset.map(Number))
      return Array.from(
        { length: max_offset - min_offset + 1 },
        (_, i) => base_year + min_offset + i
      )
    } else if (year_offset.length === 1) {
      // If year_offset is a single number
      return [base_year + Number(year_offset[0])]
    } else {
      return [base_year]
    }
  })

  const all_years = year.length
    ? [...new Set([...year, ...adjusted_years])].sort((a, b) => a - b)
    : []

  return {
    year,
    week,
    career_year,
    career_game,
    all_years
  }
}

export const get_per_game_cte_table_name = ({
  params = {},
  is_team = false
} = {}) => {
  const { week, career_year, career_game, all_years } = get_default_params({
    params
  })

  const prefix = is_team ? 'team' : 'player'

  const matchup_opponent_type = params.matchup_opponent_type || null
  const matchup_opponent_suffix = matchup_opponent_type
    ? `_${matchup_opponent_type}`
    : ''

  return get_table_hash(
    `${prefix}_games_played${matchup_opponent_suffix}_years_${all_years.join('_')}_weeks_${week.join('_')}_career_year_${career_year.join('_')}_career_game_${career_game.join('_')}`
  )
}

const add_player_per_game_cte = ({
  players_query,
  params,
  rate_type_table_name,
  splits = []
}) => {
  const { week, career_year, career_game, all_years } = get_default_params({
    params
  })
  const { seas_type } = get_play_by_play_default_params({ params })

  let cte_query = db('player_gamelogs')
    .select('player_gamelogs.pid')
    .leftJoin('nfl_games', 'nfl_games.esbid', 'player_gamelogs.esbid')
    .count('* as rate_type_total_count')
    .select(db.raw('array_agg(distinct player_gamelogs.tm) as teams'))
    .whereIn('nfl_games.seas_type', seas_type)
    .where('player_gamelogs.active', true)

  if (career_year.length) {
    cte_query = cte_query.leftJoin('player_seasonlogs', function () {
      this.on('player_seasonlogs.pid', 'player_gamelogs.pid')
      this.andOn('player_seasonlogs.year', 'nfl_games.year')
      this.andOn('player_seasonlogs.seas_type', 'nfl_games.seas_type')
    })
  }

  if (all_years.length) {
    cte_query.whereIn('nfl_games.year', all_years)
  }

  if (week.length) {
    cte_query.whereIn('nfl_games.week', week)
  }

  if (career_year.length === 2) {
    const min_career_year = Math.min(...career_year.map(Number))
    const max_career_year = Math.max(...career_year.map(Number))
    cte_query.whereBetween('player_seasonlogs.career_year', [
      min_career_year,
      max_career_year
    ])
  }

  if (career_game.length === 2) {
    const min_career_game = Math.min(...career_game.map(Number))
    const max_career_game = Math.max(...career_game.map(Number))
    cte_query.whereBetween('player_gamelogs.career_game', [
      min_career_game,
      max_career_game
    ])
  }

  for (const split of splits) {
    if (split === 'year') {
      cte_query.select('nfl_games.year')
      cte_query.groupBy('nfl_games.year')
    }

    if (split === 'week') {
      cte_query.select('nfl_games.week')
      cte_query.groupBy('nfl_games.week')
    }
  }

  cte_query.groupBy('player_gamelogs.pid')

  players_query.with(rate_type_table_name, cte_query)
}

const add_team_per_game_cte = ({
  players_query,
  params,
  rate_type_table_name,
  splits = []
}) => {
  const { week, all_years } = get_default_params({
    params
  })
  const { seas_type } = get_play_by_play_default_params({ params })

  const cte_query = db('nfl_plays')
    .select('nfl_plays.off as team')
    .countDistinct('nfl_plays.esbid as rate_type_total_count')
    .whereIn('nfl_plays.seas_type', seas_type)

  if (all_years.length) {
    cte_query.whereIn('nfl_plays.year', all_years)
  }

  if (week.length) {
    cte_query.whereIn('nfl_plays.week', week)
  }

  for (const split of splits) {
    if (split === 'year') {
      cte_query.select('nfl_plays.year')
    }

    if (split === 'week') {
      cte_query.select('nfl_plays.week')
    }
  }

  cte_query.groupBy('nfl_plays.off')

  if (splits.includes('year')) {
    cte_query.groupBy('nfl_plays.year')
  }

  if (splits.includes('week')) {
    cte_query.groupBy('nfl_plays.week')
  }

  players_query.with(rate_type_table_name, cte_query)
}

export const add_per_game_cte = ({
  players_query,
  params,
  rate_type_table_name,
  splits = [],
  is_team = false
}) => {
  if (is_team) {
    add_team_per_game_cte({
      players_query,
      params,
      rate_type_table_name,
      splits
    })
  } else {
    add_player_per_game_cte({
      players_query,
      params,
      rate_type_table_name,
      splits
    })
  }
}

export const join_player_per_game_cte = ({
  players_query,
  rate_type_table_name,
  splits,
  year_split_join_clause,
  params,
  is_team = false
}) => {
  const year_offset = params.year_offset
  const has_year_offset_range =
    year_offset &&
    Array.isArray(year_offset) &&
    year_offset.length > 1 &&
    year_offset[0] !== year_offset[1]
  const has_single_year_offset =
    year_offset &&
    ((Array.isArray(year_offset) &&
      (year_offset.length === 1 || year_offset[0] === year_offset[1])) ||
      typeof year_offset === 'number')

  players_query.leftJoin(rate_type_table_name, function () {
    this.on(`${rate_type_table_name}.pid`, 'player.pid')

    if (splits.includes('year') && year_split_join_clause) {
      if (has_year_offset_range) {
        const min_offset = Math.min(year_offset[0], year_offset[1])
        const max_offset = Math.max(year_offset[0], year_offset[1])
        this.on(
          db.raw(
            `${rate_type_table_name}.year BETWEEN player_years.year + ? AND player_years.year + ?`,
            [min_offset, max_offset]
          )
        )
      } else if (has_single_year_offset) {
        const offset = Array.isArray(year_offset) ? year_offset[0] : year_offset
        this.on(
          db.raw(`${rate_type_table_name}.year = player_years.year + ?`, [
            offset
          ])
        )
      } else {
        const single_year_param_set =
          params.year &&
          (Array.isArray(params.year) ? params.year.length === 1 : true)
        if (single_year_param_set) {
          const specific_year = Array.isArray(params.year)
            ? params.year[0]
            : params.year
          this.andOn(
            `${rate_type_table_name}.year`,
            '=',
            db.raw('?', [specific_year])
          )
        } else {
          this.on(`${rate_type_table_name}.year`, year_split_join_clause)
        }
      }
    }

    // Add week join condition if 'week' split is enabled
    if (splits.includes('week')) {
      this.andOn(`${rate_type_table_name}.week`, '=', 'player_years_weeks.week')
    }
  })
}

export const join_team_per_game_cte = ({
  players_query,
  rate_type_table_name,
  splits,
  year_split_join_clause,
  params
}) => {
  const year_offset = params.year_offset
  const has_year_offset_range =
    year_offset &&
    Array.isArray(year_offset) &&
    year_offset.length > 1 &&
    year_offset[0] !== year_offset[1]
  const has_single_year_offset =
    year_offset &&
    ((Array.isArray(year_offset) &&
      (year_offset.length === 1 || year_offset[0] === year_offset[1])) ||
      typeof year_offset === 'number')

  players_query.leftJoin(rate_type_table_name, function () {
    const matchup_opponent_type = Array.isArray(params.matchup_opponent_type)
      ? params.matchup_opponent_type[0] &&
        typeof params.matchup_opponent_type[0] === 'object'
        ? null
        : params.matchup_opponent_type[0]
      : params.matchup_opponent_type

    if (matchup_opponent_type) {
      switch (matchup_opponent_type) {
        case 'current_week_opponent_total':
          this.on(
            `${rate_type_table_name}.team`,
            'current_week_opponents.opponent'
          )
          break
        case 'next_week_opponent_total':
          this.on(
            `${rate_type_table_name}.team`,
            'next_week_opponents.opponent'
          )
          break
        default:
          console.log(`Unknown matchup_opponent_type: ${matchup_opponent_type}`)
          break
      }
    } else {
      this.on(`${rate_type_table_name}.team`, 'player.current_nfl_team')
    }

    if (splits.includes('year') && year_split_join_clause) {
      if (has_year_offset_range) {
        const min_offset = Math.min(year_offset[0], year_offset[1])
        const max_offset = Math.max(year_offset[0], year_offset[1])
        this.on(
          db.raw(
            `${rate_type_table_name}.year BETWEEN player_years.year + ? AND player_years.year + ?`,
            [min_offset, max_offset]
          )
        )
      } else if (has_single_year_offset) {
        const offset = Array.isArray(year_offset) ? year_offset[0] : year_offset
        this.on(
          db.raw(`${rate_type_table_name}.year = player_years.year + ?`, [
            offset
          ])
        )
      } else {
        const single_year_param_set =
          params.year &&
          (Array.isArray(params.year) ? params.year.length === 1 : true)
        if (single_year_param_set) {
          const specific_year = Array.isArray(params.year)
            ? params.year[0]
            : params.year
          this.andOn(
            `${rate_type_table_name}.year`,
            '=',
            db.raw('?', [specific_year])
          )
        } else {
          this.on(`${rate_type_table_name}.year`, year_split_join_clause)
        }
      }
    }

    // Add week join condition if 'week' split is enabled
    if (splits.includes('week')) {
      this.andOn(`${rate_type_table_name}.week`, '=', 'player_years_weeks.week')
    }
  })
}

export const join_per_game_cte = ({
  players_query,
  rate_type_table_name,
  splits,
  year_split_join_clause,
  params,
  is_team = false
}) => {
  if (is_team) {
    join_team_per_game_cte({
      players_query,
      rate_type_table_name,
      splits,
      year_split_join_clause,
      params
    })
  } else {
    join_player_per_game_cte({
      players_query,
      rate_type_table_name,
      splits,
      year_split_join_clause,
      params
    })
  }
}
