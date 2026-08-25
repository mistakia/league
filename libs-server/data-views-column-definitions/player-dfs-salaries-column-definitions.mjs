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
    const { db, players_query, pid_reference, year_reference, week_reference } =
      query_context
    const cte_name = table_alias

    const week_split = Boolean(week_reference)
    const nfl_week = week_split
      ? resolve_nfl_week_ids({ params })
      : single_nfl_week

    // player_salaries carries no slate-type discriminator: a book (source_id)
    // that lists a player in more than one same-week slate (observed FanDuel:
    // 'NFL Main' plus 'NFL Single Game') stores one row per slate at different
    // prices, keyed by source_contest_id. Left unfiltered, the leftJoin fans a
    // player's (pid, week) cell into duplicate rows. Select the canonical
    // (main-slate) price by keeping, per (pid, year, week), the row whose slate
    // covers the most distinct games in the requested window -- the main slate
    // spans the full slate of games while a single-game slate covers exactly
    // one. Ties break deterministically on source_contest_id.
    const base_query = db('player_salaries')
      .select(
        'player_salaries.pid',
        'player_salaries.salary',
        'nfl_games.season_year as year',
        'nfl_games.week',
        'player_salaries.source_id',
        'player_salaries.source_contest_id',
        'player_salaries.esbid'
      )
      .join('nfl_games', function () {
        this.on('player_salaries.esbid', '=', 'nfl_games.esbid')
      })
      .whereIn('player_salaries.source_id', platform_source_id)
      .whereIn('nfl_games.nfl_week_id', nfl_week)

    if (career_year.length) {
      base_query.join('player_seasonlogs', function () {
        this.on('player_salaries.pid', '=', 'player_seasonlogs.pid')
          .andOn('nfl_games.season_year', '=', 'player_seasonlogs.season_year')
          .andOn('nfl_games.season_type', '=', 'player_seasonlogs.season_type')
      })
      base_query.whereBetween('player_seasonlogs.career_year', [
        Math.min(career_year[0], career_year[1]),
        Math.max(career_year[0], career_year[1])
      ])
    }

    if (career_game.length) {
      base_query.join('player_gamelogs', function () {
        this.on('player_salaries.pid', '=', 'player_gamelogs.pid').andOn(
          'nfl_games.esbid',
          '=',
          'player_gamelogs.esbid'
        )
      })
      base_query.whereBetween('player_gamelogs.career_game', [
        Math.min(career_game[0], career_game[1]),
        Math.max(career_game[0], career_game[1])
      ])
    }

    // slate_size = distinct games each (source_id, contest) covers in the
    // requested window, used only to rank a player's slates so the main-slate
    // price wins. Postgres forbids DISTINCT inside a window aggregate, so the
    // count is expressed as the dense_rank identity: within any partition,
    // count(distinct x) = dense_rank() ascending + dense_rank() descending - 1.
    //
    // Computing it as a window over dfs_base rather than as a grouped aggregate
    // joined back to dfs_base is load-bearing for the PLAN, not just for
    // tidiness. The self-join's keys (source_id, source_contest_id) are
    // perfectly correlated by construction, but the planner treats them as
    // independent and multiplies the selectivities, collapsing the estimate to
    // rows=1 against ~30k actual. That estimate propagates through the DISTINCT
    // ON, and the outer query then picks a nested loop that re-executes this
    // whole CTE once per outer row.
    //
    // The identity is exact only while the ranked column has no NULLs
    // (dense_rank ranks a NULL, count(distinct) ignores it). esbid is the inner
    // join key to nfl_games above, so it cannot be NULL here.
    const slate_size_expr = db.raw(
      'dense_rank() over (partition by "source_id", "source_contest_id" order by "esbid")' +
        ' + dense_rank() over (partition by "source_id", "source_contest_id" order by "esbid" desc)' +
        ' - 1 as "slate_size"'
    )

    const ranked_query = db('dfs_base').select('dfs_base.*', slate_size_expr)

    const cte_query = db
      .with('dfs_base', base_query)
      .with('dfs_ranked', ranked_query)
      .distinctOn('dfs_ranked.pid', 'dfs_ranked.year', 'dfs_ranked.week')
      .select(
        'dfs_ranked.pid',
        'dfs_ranked.salary',
        'dfs_ranked.year',
        'dfs_ranked.week'
      )
      .from('dfs_ranked')
      .orderBy([
        { column: 'dfs_ranked.pid' },
        { column: 'dfs_ranked.year' },
        { column: 'dfs_ranked.week' },
        { column: 'dfs_ranked.slate_size', order: 'desc' },
        { column: 'dfs_ranked.source_contest_id' }
      ])

    players_query.with(cte_name, cte_query)
    const join_method = join_type === 'INNER' ? 'innerJoin' : 'leftJoin'
    players_query[join_method](cte_name, function () {
      this.on(`${cte_name}.pid`, '=', pid_reference)
      if (week_split) {
        // Correlate on year too: without it a same-week salary from another
        // year would match a different year's cell (year_range spans multiple
        // years when the view sets no year filter). year_reference resolves to
        // player_years_weeks.year (the week relation's own, always-joined year
        // column) for player_year_week cells, so it is reachable in both
        // year+week and week-only splits.
        this.andOn(db.raw(`${cte_name}.year = ${year_reference}`))
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
