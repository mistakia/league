import db from '#db'
import { current_season } from '#constants'
import get_join_func from '#libs-server/get-join-func.mjs'
import get_table_hash from '#libs-server/data-views/get-table-hash.mjs'
import { resolve_year_offset_range } from '#libs-server/data-views/param-utils.mjs'
import {
  create_date_based_cache_info,
  CACHE_TTL
} from '#libs-server/data-views/cache-info-utils.mjs'

// TODO career_year

// keeptradecut_valuations is a DAILY feed keyed (pid, is_superflex,
// observed_at) with one row per observation carrying up to three metrics.
// keeptradecut_value is universal; the two ranks are present only on
// full-scrape observations, so the daily importer path writes value-only rows.
//
// That asymmetry is why every lookup in this file is AS-OF rather than an
// equality match on a boundary date, and why each carries an IS NOT NULL on the
// metric it selects. Both properties are load-bearing:
//
//   - Equality on a boundary date drops the whole row whenever the scraper
//     missed that exact day. Measured 2026-07-31: 17 of the 124 NFL weeks in
//     the KTC era and 1 of the 7 opening days have no observation on the day
//     itself, so the pre-existing year-axis equality match was already
//     returning nothing for one season in seven.
//   - Without the metric predicate, "latest observation" resolves to the latest
//     VALUE-ONLY row for 731 of the 742 players who have ever carried a
//     position rank, so a rank column reads NULL for 98.5% of the population.
//
// Both failures are silent -- valid SQL, no error, just an absent or empty
// column -- which is why they survived so long.
const METRIC_COLUMNS = {
  value: 'keeptradecut_value',
  overall_rank: 'overall_rank',
  position_rank: 'position_rank'
}

const get_default_params = ({ params = {} } = {}) => {
  const date = params.date || null
  const year = Array.isArray(params.year)
    ? params.year[0]
    : params.year || current_season.year

  const year_offset_single = Array.isArray(params.year_offset)
    ? params.year_offset[0]
    : params.year_offset || 0
  return { date, year, year_offset_single }
}

const is_superflex_from_params = (params = {}) => Number(params.qb || 2) === 2

const get_cache_info_for_keeptradecut = create_date_based_cache_info({
  get_date_params: ({ params = {} } = {}) => get_default_params({ params }),
  calculate_ttl: ({ date, year }) => {
    if (date) {
      return CACHE_TTL.THIRTY_DAYS
    }
    return year === current_season.year
      ? CACHE_TTL.SIX_HOURS
      : CACHE_TTL.THIRTY_DAYS
  }
})

const generate_table_alias = ({ type, params = {}, row_axes = [] } = {}) => {
  const { date, year, year_offset_single } = get_default_params({ params })
  // row_axes participates in the alias because the same column at the same
  // params emits a different boundary per axis; without it a week-split and a
  // year-split request for one column would collide on one alias.
  const axes = [...row_axes].sort().join('-')
  const key = `keeptradecut_${type}_data_${date || ''}_year_${year || ''}_year_offset_${year_offset_single || ''}_axes_${axes}`
  return get_table_hash(key)
}

// The single as-of lookup every axis uses: the most recent observation at or
// before `boundary_sql` that actually carries `metric_column`. A null boundary
// means "no upper bound" -- the latest observation outright.
const as_of_observed_at = ({
  metric_column,
  params,
  data_view_options,
  boundary_sql = null
}) =>
  function () {
    this.select(db.raw('MAX(observed_at)'))
      .from('keeptradecut_valuations')
      .where('pid', db.raw(data_view_options.pid_reference))
      .where('is_superflex', db.raw('?', [is_superflex_from_params(params)]))
      .whereNotNull(metric_column)

    if (boundary_sql) {
      this.where('observed_at', '<=', db.raw(boundary_sql))
    }
  }

const keeptradecut_join = ({
  metric_column,
  query,
  table_name,
  join_type = 'LEFT',
  row_axes = [],
  params = {},
  data_view_options = {}
}) => {
  // using an inner join for week splits because its much faster, not sure why
  const join_func = get_join_func(
    row_axes.includes('week') ? 'INNER' : join_type
  )
  const { year_offset_single } = get_default_params({ params })

  if (row_axes.includes('year') && !data_view_options.opening_days_joined) {
    query.leftJoin(
      'opening_days',
      'opening_days.year',
      data_view_options.year_reference
    )
    data_view_options.opening_days_joined = true
  }

  if (
    row_axes.includes('week') &&
    !data_view_options.nfl_year_week_timestamp_joined
  ) {
    // player_years_weeks always projects both year and week, so this joins on
    // the full key unconditionally. The previous `on true` fallback for a
    // week-without-year request was an unguarded cross join.
    query.leftJoin('nfl_year_week_timestamp', function () {
      this.on('nfl_year_week_timestamp.year', '=', 'player_years_weeks.year')
      this.on('nfl_year_week_timestamp.week', '=', 'player_years_weeks.week')
    })
    data_view_options.nfl_year_week_timestamp_joined = true
  }

  const join_conditions = function () {
    this.on(`${table_name}.pid`, '=', data_view_options.pid_reference)
    this.andOn(
      `${table_name}.is_superflex`,
      '=',
      db.raw('?', [is_superflex_from_params(params)])
    )

    let boundary_sql = null

    if (row_axes.includes('week')) {
      // TODO handle year_offset_single and week_offset_single
      //
      // week_timestamp is an integer epoch on a materialized view this cluster
      // does not retype, so it is lifted to the instant domain here. Both sides
      // hold America/New_York local midnight, so this is a unit conversion and
      // not a semantic change. The matview retype is a recorded follow-up that
      // deletes this cast.
      boundary_sql = 'to_timestamp(nfl_year_week_timestamp.week_timestamp)'
    } else if (row_axes.includes('year')) {
      boundary_sql = `(date_trunc('day', opening_days.opening_day) + interval '${year_offset_single} year')`

      // TODO pretty sure this is always truthy
      if (data_view_options.year_reference) {
        this.andOn(
          db.raw(`opening_days.year`),
          '=',
          db.raw(`(${data_view_options.year_reference})`)
        )
      } else if (params.year) {
        const year_array = Array.isArray(params.year)
          ? params.year
          : [params.year]
        if (year_array.length > 0) {
          this.andOn(db.raw(`opening_days.year IN (${year_array.join(', ')})`))
        }
      }
    } else if (params.date) {
      // The old form carried `AT TIME ZONE 'UTC'` here. It was a verified no-op
      // on both DST sides against the epoch column, and translating it onto a
      // timestamptz would introduce a four-hour shift where none exists, so it
      // is deleted rather than carried forward.
      boundary_sql = db
        .raw(
          `(to_timestamp(?, 'YYYY-MM-DD') + interval '${year_offset_single} year')`,
          [params.date]
        )
        .toString()
    }

    this.andOn(
      `${table_name}.observed_at`,
      '=',
      as_of_observed_at({
        metric_column,
        params,
        data_view_options,
        boundary_sql
      })
    )
  }

  query[join_func]('keeptradecut_valuations as ' + table_name, join_conditions)
}

// keeptradecut_valuations is date-grained (no year column), so the generic
// year-based correlated-aggregate path in select-string -- which filters
// `inner_table.year BETWEEN ...` -- cannot reduce a range year_offset; it
// emitted `(SELECT SUM(<unjoined alias>.v) ...)` against a relation the
// range-offset join-skip never materialized (invalid SQL), and the single-value
// join silently collapsed the range to year_offset[0].
//
// This bespoke main_select_string_year_offset_range (consumed by select-string's
// has_year_offset_range branch) instead AVERAGES the as-of snapshots at the
// offset-shifted opening days, mirroring the single-offset year-split semantics
// generalised across the range. KTC value/ranks are point-in-time, not
// additive, so AVG (not SUM) is the correct reduction -- consistent with
// player_adp.
//
// Each offset resolves through the same as-of rule as the join: the latest
// observation at or before that opening day carrying the metric. An offset with
// no such observation contributes NULL, which AVG skips, rather than dragging
// the average toward zero.
const keeptradecut_year_offset_range_select =
  (metric_column) =>
  ({ params = {}, data_view_options = {} }) => {
    const offset_range = resolve_year_offset_range(params)
    const [min_off, max_off] = offset_range
    const pid_reference = data_view_options.pid_reference
    const is_superflex = is_superflex_from_params(params)
    // `anchor` is interpolated raw into the SQL, so it must always be a real
    // number: with no year_reference and no year param, Number(undefined) is NaN
    // and the emitted `od_o.year = NaN` parses as a reference to a column named
    // "nan" -- a 42703 on any year_offset range request that omits year. Default
    // to the current season, matching get_default_params and every other year
    // basis in this file.
    const anchor = data_view_options.year_reference
      ? `(${data_view_options.year_reference})`
      : get_default_params({ params }).year

    const per_offset_selects = []
    for (let off = min_off; off <= max_off; off++) {
      per_offset_selects.push(
        `(SELECT ktc_o.${metric_column} FROM keeptradecut_valuations ktc_o ` +
          `WHERE ktc_o.pid = ${pid_reference} AND ktc_o.is_superflex = ${is_superflex} ` +
          `AND ktc_o.${metric_column} IS NOT NULL ` +
          `AND ktc_o.observed_at <= (date_trunc('day', od_o.opening_day) + interval '${off} year') ` +
          `ORDER BY ktc_o.observed_at DESC LIMIT 1)`
      )
    }

    return (
      `(SELECT AVG(offset_value) FROM opening_days od_o ` +
      `CROSS JOIN LATERAL (VALUES ${per_offset_selects
        .map((s) => `(${s})`)
        .join(', ')}) AS offsets(offset_value) ` +
      `WHERE od_o.year = ${anchor})`
    )
  }

const create_keeptradecut_definition = (type) => {
  const metric_column = METRIC_COLUMNS[type]

  return {
    table_alias: (opts) => generate_table_alias({ type, ...opts }),
    select_as: () => `player_keeptradecut_${type}`,
    column_name: metric_column,
    main_where: ({ table_name }) => `${table_name}.${metric_column}`,
    join: ({ ...args }) => keeptradecut_join({ metric_column, ...args }),
    main_select_string_year_offset_range:
      keeptradecut_year_offset_range_select(metric_column),
    year_select: ({ row_axes }) => {
      // Under as-of semantics the observation can predate the boundary, so the
      // row's year label must come from the REQUESTED period rather than from
      // the observation's own timestamp. Both branches below are exact:
      // opening_days.year is the anchor year the offset was applied to, which
      // is what the old `EXTRACT(YEAR FROM d) - year_offset` reconstructed.
      if (row_axes.includes('week')) {
        return `nfl_year_week_timestamp.year`
      }
      return `opening_days.year`
    },
    week_select: () => `nfl_year_week_timestamp.week`,
    source: { grain: 'player_year', supports_row_axes: ['year', 'week'] },
    get_cache_info: get_cache_info_for_keeptradecut
  }
}

export default {
  player_keeptradecut_value: create_keeptradecut_definition('value'),
  player_keeptradecut_overall_rank:
    create_keeptradecut_definition('overall_rank'),
  player_keeptradecut_position_rank:
    create_keeptradecut_definition('position_rank')
}
