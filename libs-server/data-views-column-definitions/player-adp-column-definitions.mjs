import get_table_hash from '#libs-server/data-views/get-table-hash.mjs'
import { create_season_cache_info } from '#libs-server/data-views/cache-info-utils.mjs'
import {
  resolve_year_offset_range,
  offset_expanded_years,
  emit_year_match
} from '#libs-server/data-views/param-utils.mjs'
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
//
// year_offset is threaded in two correlated places (the prior bug silently
// dropped it in both): (1) the CTE's year filter is offset-expanded so the
// shifted target year(s) are present in the relation the subquery/join reads;
// (2) the join correlates the CTE year to the base-year anchor THROUGH the
// offset via the shared emit_year_match primitive (anchored `= ref+k` / range
// `BETWEEN`, or, with no anchor, the `{base x offset}` IN-list). select-string's
// correlated-aggregate path reads the same offset-expanded CTE for range
// offsets, so no per-row anchor is needed there.
//
// CTE registration is decoupled from join emission via register_ctes (always
// invoked) because get-data-view-results skips the source join for a range
// year_offset with no where-clause; without the decoupling the correlated
// subquery would reference an unregistered CTE and emit invalid SQL.
const register_player_adp_cte = ({ query, params, data_view_options }) => {
  const query_context = data_view_options?.query_context
  if (!query_context) return
  const { db } = query_context
  const cte_name = generate_table_alias({ params })
  if (!query_context.registered_adp_ctes) {
    query_context.registered_adp_ctes = new Set()
  }
  if (query_context.registered_adp_ctes.has(cte_name)) return

  const {
    year,
    adp_source_id,
    scoring_class,
    num_qb,
    duration,
    draft_pool,
    contest_style
  } = get_default_params({ params })
  const cte_years = offset_expanded_years(
    year,
    resolve_year_offset_range(params)
  )

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
    .whereIn('player_adp_index.year', cte_years)
    .whereIn('adp_format.scoring_class', scoring_class)
    .whereIn('adp_format.num_qb', num_qb)
    .whereIn('adp_format.duration', duration)
    .whereIn('adp_format.draft_pool', draft_pool)
    .whereIn('adp_format.contest_style', contest_style)
    // Drop the undrafted sentinel: Sleeper's feed reports adp=999 for every
    // player off the board, and the importer stores it verbatim (~97% of
    // Sleeper rows). 999 is not a draft position -- surfacing it pollutes
    // ascending sorts and the AVG range-offset aggregate, and leaks thousands
    // of noise rows into every Sleeper-sourced view. No legitimate ADP from
    // any source approaches 999 (observed max ~240), so this is a universal
    // guard. Excluding the row makes player_adp resolve to NULL (LEFT join
    // absence) for undrafted players, the correct "no meaningful ADP" value.
    .where('player_adp_index.adp', '<', 999)

  query.with(cte_name, cte_query)
  query_context.registered_adp_ctes.add(cte_name)
}

const player_adp_source = {
  grain: 'player_year',
  // The offset-base year(s) the CTE is built around. select-string's
  // correlated-aggregate path crosses these with the year_offset range to emit
  // an explicit `year IN (...)` predicate on the subquery -- matching the
  // offset-expanded year filter register_player_adp_cte already applies to the
  // CTE -- instead of trusting the CTE to have pre-filtered itself.
  year_default: (params) => get_default_params({ params }).year,
  attach: ({ query_context, params, table_alias, join_type }) => {
    const { db, players_query, pid_reference, year_reference } = query_context
    const { year } = get_default_params({ params })
    const cte_name = table_alias

    register_player_adp_cte({
      query: players_query,
      params,
      data_view_options: { query_context }
    })

    const offset_range = resolve_year_offset_range(params)
    const join_method = join_type === 'INNER' ? 'innerJoin' : 'leftJoin'
    players_query[join_method](cte_name, function () {
      this.on(`${cte_name}.pid`, '=', pid_reference)
      if (offset_range) {
        // Offset present: correlate the CTE year to the base-year anchor
        // through the offset (or, with no anchor, an offset-shifted IN-list).
        emit_year_match({
          builder: this,
          db,
          year_reference,
          source: { year_default: () => year },
          key_columns: { year: 'year' },
          params,
          ref: cte_name
        })
      } else if (year_reference) {
        this.andOn(db.raw(`${cte_name}.year = ${year_reference}`))
      }
    })
  }
}

// Range-offset aggregate per column: select-string's correlated-aggregate path
// reduces the offset window with this function (default SUM). ADP statistics are
// not additive across years -- adp/percent_drafted are means (AVG), min_pick is
// a floor (MIN), max_pick a ceiling (MAX); only sample_size accumulates (SUM).
// AVG of std_dev across years is an approximation (a sample-weighted pooled
// std dev would need the per-year sample sizes); AVG is the least-wrong closed
// form and is documented as such.
const create_player_adp_field = (field, select_as, range_offset_aggregate) => ({
  column_name: field,
  select_as: () => select_as,
  table_alias: generate_table_alias,
  source: player_adp_source,
  register_ctes: ({ query, params, data_view_options }) =>
    register_player_adp_cte({ query, params, data_view_options }),
  range_offset_aggregate,
  get_cache_info
})

export default {
  player_adp: create_player_adp_field('adp', 'adp', 'AVG'),
  player_adp_min: create_player_adp_field('min_pick', 'adp_min', 'MIN'),
  player_adp_max: create_player_adp_field('max_pick', 'adp_max', 'MAX'),
  player_adp_stddev: create_player_adp_field('std_dev', 'adp_stddev', 'AVG'),
  player_adp_sample_size: create_player_adp_field(
    'sample_size',
    'adp_sample_size',
    'SUM'
  ),
  player_percent_drafted: create_player_adp_field(
    'percent_drafted',
    'percent_drafted',
    'AVG'
  )
}
