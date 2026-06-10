import get_table_hash from '#libs-server/data-views/get-table-hash.mjs'
import { create_season_cache_info } from '#libs-server/data-views/cache-info-utils.mjs'
import { current_season } from '#constants'

// Defaults reproduce the legacy adp_type 'PPR_REDRAFT' (managed) so existing
// saved views keep rendering after the adp_type -> adp_format decomposition.
const get_default_params = ({ params = {} } = {}) => {
  const default_params = {
    year: [current_season.year],
    adp_source_id: ['SLEEPER'],
    scoring_class: ['PPR'],
    num_qb: [1],
    duration: ['REDRAFT'],
    draft_pool: ['ALL'],
    contest_style: ['MANAGED']
  }

  for (const [key, default_value] of Object.entries(default_params)) {
    let value = params[key] || default_value
    if (!Array.isArray(value)) {
      value = [value]
    }
    default_params[key] = value
  }

  return default_params
}

const get_cache_info = create_season_cache_info({
  get_params: ({ params = {} } = {}) => {
    const { year } = get_default_params({ params })
    return { year }
  }
})

const generate_table_alias = ({ params = {} } = {}) => {
  const {
    year,
    adp_source_id,
    scoring_class,
    num_qb,
    duration,
    draft_pool,
    contest_style
  } = get_default_params({ params })
  const key = `player_adp_${year.join('_')}_${adp_source_id.join('_')}_${scoring_class.join('_')}_${num_qb.join('_')}_${duration.join('_')}_${draft_pool.join('_')}_${contest_style.join('_')}`
  return get_table_hash(key)
}

// CTE-backed source: the axis filters live on the adp_format dimension, so the
// CTE pre-joins player_adp_index -> adp_format and filters by source_id, year,
// and the decomposed format axes. Because there is no source.table, select-string
// treats the (already format-scoped) CTE as the inner relation for both the
// direct-column and correlated-aggregate paths, so neither can sum across
// formats. Mirrors the player_dfs_salaries CTE attach + the player-projected
// pid/year correlation.
const player_adp_source = {
  grain: 'player_year',
  attach: ({ query_context, params, table_alias, join_type }) => {
    const {
      year,
      adp_source_id,
      scoring_class,
      num_qb,
      duration,
      draft_pool,
      contest_style
    } = get_default_params({ params })
    const { db, players_query, pid_reference, year_reference } = query_context
    const cte_name = table_alias

    const cte_query = db('player_adp_index')
      .join('adp_format', 'player_adp_index.adp_format_id', 'adp_format.id')
      .select(
        'player_adp_index.pid',
        'player_adp_index.year',
        'player_adp_index.adp',
        'player_adp_index.min_pick',
        'player_adp_index.max_pick',
        'player_adp_index.std_dev',
        'player_adp_index.sample_size',
        'player_adp_index.percent_drafted'
      )
      .whereIn('player_adp_index.source_id', adp_source_id)
      .whereIn('player_adp_index.year', year)
      .whereIn('adp_format.scoring_class', scoring_class)
      .whereIn('adp_format.num_qb', num_qb)
      .whereIn('adp_format.duration', duration)
      .whereIn('adp_format.draft_pool', draft_pool)
      .whereIn('adp_format.contest_style', contest_style)

    players_query.with(cte_name, cte_query)

    const join_method = join_type === 'INNER' ? 'innerJoin' : 'leftJoin'
    players_query[join_method](cte_name, function () {
      this.on(`${cte_name}.pid`, '=', pid_reference)
      if (year_reference) {
        this.andOn(db.raw(`${cte_name}.year = ${year_reference}`))
      }
    })
  }
}

const create_player_adp_field = (field, select_as) => ({
  column_name: field,
  select_as: () => select_as,
  table_alias: generate_table_alias,
  source: player_adp_source,
  get_cache_info
})

export default {
  player_adp: create_player_adp_field('adp', 'adp'),
  player_adp_min: create_player_adp_field('min_pick', 'adp_min'),
  player_adp_max: create_player_adp_field('max_pick', 'adp_max'),
  player_adp_stddev: create_player_adp_field('std_dev', 'adp_stddev'),
  player_adp_sample_size: create_player_adp_field(
    'sample_size',
    'adp_sample_size'
  ),
  player_percent_drafted: create_player_adp_field(
    'percent_drafted',
    'percent_drafted'
  )
}
