import get_table_hash from '#libs-server/data-views/get-table-hash.mjs'
import { create_season_cache_info } from '#libs-server/data-views/cache-info-utils.mjs'
import resolve_single_nfl_week_id, {
  resolve_nfl_week_ids
} from '#libs-server/data-views/resolve-single-nfl-week-id.mjs'

const get_params = ({ params = {} }) => {
  const nfl_week_id = resolve_single_nfl_week_id({ params })
  const nfl_week = [nfl_week_id]

  let career_year = params.career_year || []
  if (!Array.isArray(career_year)) {
    career_year = [career_year]
  }

  let career_game = params.career_game || []
  if (!Array.isArray(career_game)) {
    career_game = [career_game]
  }

  let platform_source_id = params.platform_source_id || ['DRAFTKINGS']
  if (!Array.isArray(platform_source_id)) {
    platform_source_id = [platform_source_id]
  }

  return {
    nfl_week,
    career_year,
    career_game,
    platform_source_id
  }
}

const get_cache_info = create_season_cache_info({ get_params })

const generate_table_alias = ({ params = {} } = {}) => {
  const { nfl_week, career_year, career_game, platform_source_id } = get_params(
    { params }
  )
  const key = `player_dfs_salaries_${nfl_week.join('_')}_${career_year.join('_')}_${career_game.join('_')}_${platform_source_id.join('_')}`
  return get_table_hash(key)
}

const player_dfs_salaries_source = {
  // Grain 'player': the salary fact lives in player_salaries keyed by esbid, so
  // the CTE derives year/week by joining nfl_games and the attach owns its join.
  //
  // Split-aware behavior (mirrors apply_projected_join in the projections
  // column, the canonical per-week-fact-in-a-week-split pattern):
  //   - Week-split cell (week_reference present): the CTE spans ALL requested
  //     weeks and the join correlates on year AND week so each week row shows
  //     that week's salary. Collapsing to a single week + pid-only join here
  //     broadcast one week's salary across every week row.
  //   - Season / non-week cell (no week_reference): collapse to a single week
  //     and join pid-only, unchanged.
  grain: 'player',
  attach: ({ query_context, params, table_alias, join_type }) => {
    const {
      nfl_week: single_nfl_week,
      career_year,
      career_game,
      platform_source_id
    } = get_params({ params })
    const { db, players_query, pid_reference, week_reference } = query_context
    const cte_name = table_alias

    const week_split = Boolean(week_reference)
    const nfl_week = week_split
      ? resolve_nfl_week_ids({ params })
      : single_nfl_week

    const cte_query = db('player_salaries')
      .select(
        'player_salaries.pid',
        'player_salaries.salary',
        'nfl_games.year',
        'nfl_games.week'
      )
      .join('nfl_games', function () {
        this.on('player_salaries.esbid', '=', 'nfl_games.esbid')
      })
      .whereIn('player_salaries.source_id', platform_source_id)
      .whereIn('nfl_games.nfl_week_id', nfl_week)

    if (career_year.length) {
      cte_query.join('player_seasonlogs', function () {
        this.on('player_salaries.pid', '=', 'player_seasonlogs.pid')
          .andOn('nfl_games.year', '=', 'player_seasonlogs.year')
          .andOn('nfl_games.seas_type', '=', 'player_seasonlogs.seas_type')
      })
      cte_query.whereBetween('player_seasonlogs.career_year', [
        Math.min(career_year[0], career_year[1]),
        Math.max(career_year[0], career_year[1])
      ])
    }

    if (career_game.length) {
      cte_query.join('player_gamelogs', function () {
        this.on('player_salaries.pid', '=', 'player_gamelogs.pid').andOn(
          'nfl_games.esbid',
          '=',
          'player_gamelogs.esbid'
        )
      })
      cte_query.whereBetween('player_gamelogs.career_game', [
        Math.min(career_game[0], career_game[1]),
        Math.max(career_game[0], career_game[1])
      ])
    }

    players_query.with(cte_name, cte_query)
    const join_method = join_type === 'INNER' ? 'innerJoin' : 'leftJoin'
    players_query[join_method](cte_name, function () {
      this.on(`${cte_name}.pid`, '=', pid_reference)
      if (week_split) {
        // Correlate on year too: without it a same-week salary from another
        // year would match a different year's cell (year_range spans multiple
        // years when the view sets no year filter). year_reference is the
        // identity's canonical player_years.year, but a week-only outer query
        // joins only the week relation (player_years_weeks) -- player_years is
        // defined as a CTE but never joined, so player_years.year is
        // unreachable here. Correlate against the week relation's own year
        // column, which is present in the FROM and equal by construction
        // (player_years_weeks INNER JOINs nfl_year_week_timestamp on year).
        const week_rel = week_reference.slice(
          0,
          week_reference.lastIndexOf('.')
        )
        this.andOn(db.raw(`${cte_name}.year = ${week_rel}.year`))
        this.andOn(db.raw(`${cte_name}.week = ${week_reference}`))
      }
    })
  }
}

const create_player_dfs_salaries_field = (field) => ({
  column_name: field,
  select_as: () => 'dfs_salary',
  table_alias: generate_table_alias,
  source: player_dfs_salaries_source,
  get_cache_info
})

export default {
  player_dfs_salary: create_player_dfs_salaries_field('salary')
}
