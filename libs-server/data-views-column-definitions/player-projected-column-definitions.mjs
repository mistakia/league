import {
  DEFAULT_SCORING_FORMAT_ID,
  DEFAULT_LEAGUE_FORMAT_ID
} from '#libs-shared'
import {
  current_season,
  external_data_sources,
  projected_base_stats
} from '#constants'
import { CACHE_TTL } from '#libs-server/data-views/cache-info-utils.mjs'
import { parse_nfl_week_identifier } from '#libs-shared/nfl-week-identifier.mjs'
import resolve_single_nfl_week_id from '#libs-server/data-views/resolve-single-nfl-week-id.mjs'

import db from '#db'
import get_table_hash from '#libs-server/data-views/get-table-hash.mjs'
import {
  resolve_year_offset_range,
  emit_year_match
} from '#libs-server/data-views/param-utils.mjs'

// TODO career_year

const get_default_params = ({ params = {} }) => {
  let year, week, seas_type, nfl_week

  if (params.nfl_week_id || params.single_nfl_week_id) {
    if (params.single_nfl_week_id) {
      const resolved = resolve_single_nfl_week_id({ params })
      nfl_week = resolved ? [resolved] : []
    } else {
      nfl_week = Array.isArray(params.nfl_week_id)
        ? params.nfl_week_id
        : [params.nfl_week_id]
    }
    // Decompose first nfl_week value for single-value contexts
    const parsed = nfl_week.length
      ? parse_nfl_week_identifier({ identifier: nfl_week[0] })
      : null
    year = parsed ? parsed.year : current_season.year
    week = parsed ? parsed.week : 0
    seas_type = parsed ? parsed.seas_type : 'REG'
  } else {
    year = Array.isArray(params.year)
      ? params.year[0]
      : params.year || current_season.year
    week = Array.isArray(params.week) ? params.week[0] : params.week || 0
    seas_type = Array.isArray(params.seas_type)
      ? params.seas_type[0]
      : params.seas_type || 'REG'
    nfl_week = null
  }

  const scoring_format_id =
    params.scoring_format_id || DEFAULT_SCORING_FORMAT_ID
  const league_format_id = params.league_format_id || DEFAULT_LEAGUE_FORMAT_ID
  const league_id = params.league_id || 1

  // Projection source (projections_index / ros_projections only). Defaults to
  // the AVERAGE consensus so a column with no `sourceid` param is unchanged.
  const sourceid_param = Array.isArray(params.sourceid)
    ? params.sourceid[0]
    : params.sourceid
  const sourceid =
    sourceid_param == null || sourceid_param === ''
      ? external_data_sources.AVERAGE
      : Number(sourceid_param)

  return {
    year,
    week,
    seas_type,
    nfl_week,
    scoring_format_id,
    league_format_id,
    league_id,
    sourceid
  }
}

const get_cache_info_for_player_projected_stats = ({ params = {} } = {}) => {
  const { year, seas_type } = get_default_params({ params })
  const is_current_year_and_season =
    year === current_season.year && seas_type === current_season.nfl_seas_type

  return {
    cache_ttl: is_current_year_and_season
      ? CACHE_TTL.SIX_HOURS
      : CACHE_TTL.THIRTY_DAYS,
    cache_expire_at: null
  }
}

const get_alias_key = ({ year, week, seas_type, nfl_week }) => {
  if (nfl_week) {
    return nfl_week.join('_')
  }
  return `${year}_week_${week}_${seas_type}`
}

const projections_index_table_alias = ({ params = {} }) => {
  const p = get_default_params({ params })
  // sourceid is part of the alias key so two projection columns at the same
  // year/week/seas_type but different sources do not collapse into one shared
  // JOIN (which could carry only one sourceid predicate).
  return get_table_hash(
    `projections_index_${get_alias_key(p)}_source_${p.sourceid}`
  )
}

const league_player_projection_values_table_alias = ({ params = {} }) => {
  const p = get_default_params({ params })
  return get_table_hash(
    `league_player_projection_values_${get_alias_key(p)}_league_${p.league_id}`
  )
}

const league_format_player_projection_values_table_alias = ({
  params = {}
}) => {
  const p = get_default_params({ params })
  return get_table_hash(
    `league_format_player_projection_values_${get_alias_key(p)}_${p.league_format_id}`
  )
}

// Year and week predicates follow query_context references when the cell
// exposes them (player_year / player_year_week cells); otherwise they pin to
// the default params.
const apply_projected_join = ({
  query_context,
  params,
  table_alias,
  join_type,
  join_table_clause,
  join_year = true,
  join_week = true,
  cast_join_week_to_string = false,
  join_year_column = 'year',
  additional_conditions
}) => {
  const { players_query, pid_reference, year_reference, week_reference } =
    query_context
  const join_method = join_type === 'INNER' ? 'innerJoin' : 'leftJoin'
  const year = params.year || current_season.year
  const week = params.week || 0

  players_query[join_method](join_table_clause, function () {
    this.on(`${table_alias}.pid`, '=', pid_reference)

    if (join_year) {
      const offset_range = resolve_year_offset_range(params)
      if (offset_range) {
        // year_offset present: correlate the projection year to the base-year
        // anchor THROUGH the offset (single `= ref+k`, range `BETWEEN`, or the
        // offset-shifted default when no year_reference) via the shared
        // emit_year_match primitive. The prior code pinned to the unshifted
        // year and silently returned the base-year projection (mirrors the
        // player_adp CTE-attach year_offset-drop bug).
        emit_year_match({
          builder: this,
          db,
          year_reference,
          source: {
            year_default: () => (Array.isArray(year) ? year[0] : year)
          },
          key_columns: { year: join_year_column },
          params,
          ref: table_alias
        })
      } else if (year_reference) {
        this.andOn(
          db.raw(`${table_alias}.${join_year_column} = ${year_reference}`)
        )
        if (params.year) {
          const year_array = Array.isArray(year) ? year : [year]
          if (year_array.length) {
            this.andOn(
              db.raw(
                `${table_alias}.${join_year_column} IN (${year_array.join(',')})`
              )
            )
          }
        }
      } else {
        this.andOn(
          `${table_alias}.${join_year_column}`,
          '=',
          db.raw('?', [Array.isArray(year) ? year[0] : year])
        )
      }
    }

    if (join_week) {
      if (week_reference) {
        const week_clause = cast_join_week_to_string
          ? `CAST(${week_reference} AS VARCHAR)`
          : week_reference
        this.andOn(db.raw(`${table_alias}.week = ${week_clause}`))
        if (params.week) {
          const week_array = Array.isArray(week)
            ? week.map(String)
            : [String(week)]
          if (week_array.length) {
            this.andOn(
              db.raw(`${table_alias}.week IN (${week_array.join(',')})`)
            )
          }
        }
      } else {
        this.andOn(
          `${table_alias}.week`,
          '=',
          db.raw('?', [String(Array.isArray(week) ? week[0] : week)])
        )
      }
    }

    if (additional_conditions) {
      additional_conditions.call(this)
    }
  })
}

// year_offset RANGE columns are reduced by select-string's correlated-aggregate
// subquery, which re-scans source.table directly (outer JOIN aliases are not
// visible as relations inside a subquery). Declaring table / year_default /
// extra_predicates lets that path emit valid SQL pinned to the offset-expanded
// year window plus the same discriminators (lid / format id / scoring format /
// week / source) the JOIN enforces. Without these the subquery referenced an
// undefined relation and dropped the year filter entirely. attach_owns_join
// tells the dispatcher NOT to also emit a primary join (this source's custom
// `attach` owns the entire join, including the week dimension the bridge cannot
// express) -- otherwise the alias is joined twice.
const make_league_player_projection_source = () => ({
  grain: 'player',
  table: 'league_player_projection_values',
  attach_owns_join: true,
  year_default: (params) => [get_default_params({ params }).year],
  extra_predicates: (params) => {
    const { league_id, week } = get_default_params({ params })
    return [
      { column: 'lid', value: league_id },
      { column: 'week', value: String(week) }
    ]
  },
  attach: ({ query_context, params, table_alias, join_type }) => {
    const { league_id } = get_default_params({ params })
    apply_projected_join({
      query_context,
      params,
      table_alias,
      join_type,
      join_table_clause: `league_player_projection_values as ${table_alias}`,
      join_year: true,
      join_week: true,
      additional_conditions() {
        this.andOn(`${table_alias}.lid`, '=', db.raw('?', [league_id]))
      }
    })
  }
})

const make_league_format_player_projection_source = ({
  is_rest_of_season = false
} = {}) => ({
  grain: 'player',
  table: 'league_format_player_projection_values',
  attach_owns_join: true,
  year_default: (params) => [get_default_params({ params }).year],
  extra_predicates: (params) => {
    const { league_format_id, week } = get_default_params({ params })
    return [
      { column: 'league_format_id', value: league_format_id },
      { column: 'week', value: is_rest_of_season ? 'ros' : String(week) }
    ]
  },
  attach: ({ query_context, params, table_alias, join_type }) => {
    const { league_format_id } = get_default_params({ params })
    apply_projected_join({
      query_context,
      params,
      table_alias,
      join_type,
      join_table_clause: `league_format_player_projection_values as ${table_alias}`,
      join_year: true,
      join_week: !is_rest_of_season,
      additional_conditions() {
        this.andOn(
          `${table_alias}.league_format_id`,
          '=',
          db.raw('?', [league_format_id])
        )
        if (is_rest_of_season) {
          this.andOn(`${table_alias}.week`, '=', db.raw('?', ['ros']))
        }
      }
    })
  }
})

const make_projections_index_source = ({ is_rest_of_season = false } = {}) => ({
  grain: 'player',
  table: is_rest_of_season ? 'ros_projections' : 'projections_index',
  attach_owns_join: true,
  // season_year, not year -- see select-string.mjs's source.key_columns.year
  // read (generic year_offset_range correlated-subquery path re-scans
  // source.table directly and needs the real column name).
  key_columns: { year: 'season_year' },
  year_default: (params) => [get_default_params({ params }).year],
  extra_predicates: (params) => {
    const { seas_type, week, sourceid } = get_default_params({ params })
    // ros_projections is keyed (sourceid, pid, year) — no week/seas_type
    // discriminator — so the rest-of-season subquery pins sourceid only.
    if (is_rest_of_season) {
      return [{ column: 'sourceid', value: sourceid }]
    }
    // projections_index.week is smallint (numeric); seas_type is an enum. The
    // offset-expanded year window plus sourceid + seas_type + week discriminates
    // the source even when the JOIN used nfl_week_id.
    return [
      { column: 'sourceid', value: sourceid },
      { column: 'week', value: week },
      { column: 'season_type', value: seas_type }
    ]
  },
  attach: ({ query_context, params, table_alias, join_type }) => {
    const { seas_type, nfl_week, sourceid } = get_default_params({ params })
    const join_table_clause = is_rest_of_season
      ? `ros_projections as ${table_alias}`
      : `projections_index as ${table_alias}`
    apply_projected_join({
      query_context,
      params,
      table_alias,
      join_type,
      join_table_clause,
      join_year: true,
      join_week: !is_rest_of_season,
      join_year_column: 'season_year',
      additional_conditions() {
        // sourceid discriminates the projection provider on both tables. ros
        // carries no week/seas_type/nfl_week_id columns, so it stops here.
        this.andOn(`${table_alias}.sourceid`, '=', sourceid)
        if (is_rest_of_season) return
        if (nfl_week) {
          this.andOn(
            db.raw(
              `${table_alias}.nfl_week_id IN (${nfl_week.map(() => '?').join(',')})`,
              nfl_week
            )
          )
        } else {
          this.andOn(
            `${table_alias}.season_type`,
            '=',
            db.raw('?', [seas_type])
          )
        }
      }
    })
  }
})

// --- Projected fantasy points in-query scorer ------------------------------
//
// player_projected_points computes its value from the projections_index /
// ros_projections raw-stat row using the selected scoring format's weights,
// faithfully mirroring calculatePoints({ use_projected_stats: true }) in
// #libs-shared/calculate-points.mjs.
//
// projections_index AVERAGE is the AUTHORITATIVE, as-of-gametime frozen
// consensus projection: it retains the correct per-week starter projection
// (validated against the per-source frozen history — e.g. Joe Flacco 2025 wk9
// is 242.5 pass yds in projections_index, matching all ~10 sources; a week
// that reads 0 is a real bye/inactive, not a dropped row). The legacy
// precomputed scoring_format_player_projection_points is a per-format derived
// cache regenerated from this same projections_index (via process-projections /
// process-projections-for-scoring-format), so where the two disagreed the cache
// was the STALE store and this in-query value is the correct one. The pipeline
// re-derives that cache FROM projections_index every run (NEVER the reverse), so
// the two stay in lockstep. See task
// projected-points-in-query-scoring-source-selection.
//
// Single consumer, so the scorer is inlined here rather than extracted.

// player.primary_position is a correlatable outer column under the canonical
// `FROM player` query; the receiving-position CASE and the year_offset subquery
// both read it.
const PROJECTION_POSITION_REFERENCE = 'player.primary_position'

const resolve_scoring_format_id = ({ params = {} }) => {
  const raw = Array.isArray(params.scoring_format_id)
    ? params.scoring_format_id[0]
    : params.scoring_format_id
  return raw || DEFAULT_SCORING_FORMAT_ID
}

// Look up a scoring-format row, falling back to the default format and then to
// null (test environments with no formats seeded), mirroring the from-plays
// column's get_scoring_format. A null format yields zero offense weights.
const load_scoring_format = async (scoring_format_id) => {
  let format = await db('league_scoring_formats')
    .where({ id: scoring_format_id })
    .first()
  if (!format && scoring_format_id !== DEFAULT_SCORING_FORMAT_ID) {
    format = await db('league_scoring_formats')
      .where({ id: DEFAULT_SCORING_FORMAT_ID })
      .first()
  }
  return format || null
}

// register_ctes hook: resolve and memoize the scoring-format weights on
// data_view_options before the synchronous select / group-by / where emit reads
// them back. Idempotent per scoring_format_id; runs for both select and where
// usage of the column.
const register_projection_scoring_format = async ({
  params = {},
  data_view_options = {}
}) => {
  const scoring_format_id = resolve_scoring_format_id({ params })
  if (!data_view_options.projection_scoring_formats) {
    data_view_options.projection_scoring_formats = new Map()
  }
  if (!data_view_options.projection_scoring_formats.has(scoring_format_id)) {
    data_view_options.projection_scoring_formats.set(
      scoring_format_id,
      await load_scoring_format(scoring_format_id)
    )
  }
}

const get_projection_scoring_format = ({
  params = {},
  data_view_options = {}
}) =>
  data_view_options.projection_scoring_formats?.get(
    resolve_scoring_format_id({ params })
  ) || null

// Build the per-row fantasy-points SQL expression for a projection row.
// column_ref(name) returns the qualified column reference (a JOIN alias for the
// normal path, the bare table name for the re-scanned year_offset subquery).
const projection_fantasy_points_sql = ({
  scoring_format,
  column_ref,
  position_reference
}) => {
  const weight = (key) => Number(scoring_format?.[key]) || 0
  const stat = (name) => `COALESCE(${column_ref(name)}, 0)`

  const rec = weight('receptions')
  const rbrec = Number(scoring_format?.running_back_reception) || rec
  const wrrec = Number(scoring_format?.wide_receiver_reception) || rec
  const terec = Number(scoring_format?.tight_end_reception) || rec
  const non_uniform_rec = rbrec !== rec || wrrec !== rec || terec !== rec

  const terms = []
  for (const projected_stat of projected_base_stats) {
    if (projected_stat === 'receptions') {
      // calculatePoints: factor = league[`${pos}rec`] || league.receptions. The
      // CASE is only needed when a position weight differs from the base
      // receptions weight.
      terms.push(
        non_uniform_rec
          ? `${stat('receptions')} * (CASE ${position_reference} WHEN 'RB' THEN ${rbrec} WHEN 'WR' THEN ${wrrec} WHEN 'TE' THEN ${terec} ELSE ${rec} END)`
          : `${stat('receptions')} * ${rec}`
      )
      continue
    }
    terms.push(`${stat(projected_stat)} * ${weight(projected_stat)}`)
  }

  // Extra points, then field goals via the distance buckets. projections_index
  // never populates field_goal_yards, so calculatePoints takes the bucket branch
  // and field_goals_made is excluded from the total.
  terms.push(`${stat('extra_points_made')} * 1`)
  terms.push(`${stat('field_goals_made_0_19_yards')} * 3`)
  terms.push(`${stat('field_goals_made_20_29_yards')} * 3`)
  terms.push(`${stat('field_goals_made_30_39_yards')} * 3`)
  terms.push(`${stat('field_goals_made_40_49_yards')} * 4`)
  terms.push(`${stat('field_goals_made_50_plus_yards')} * 5`)

  // DST block (calculatePoints runs it unconditionally). Points/yards-against
  // are clipped with GREATEST. DST rows are absent from the projection tables,
  // so these terms evaluate to 0 for offense/kicker rows.
  terms.push(`${stat('defensive_sacks')} * 1`)
  terms.push(`${stat('defensive_interceptions')} * 2`)
  terms.push(`${stat('defensive_forced_fumbles')} * 1`)
  terms.push(`${stat('defensive_recovered_fumbles')} * 1`)
  terms.push(`${stat('defensive_three_and_outs')} * 1`)
  terms.push(`${stat('defensive_fourth_down_stops')} * 1`)
  terms.push(`GREATEST(${stat('defensive_points_against')} - 20, 0) * -0.4`)
  terms.push(`GREATEST(${stat('defensive_yards_against')} - 300, 0) * -0.02`)
  terms.push(`${stat('defensive_blocked_kicks')} * 3`)
  terms.push(`${stat('defensive_safeties')} * 2`)
  terms.push(`${stat('defensive_two_point_returns')} * 2`)
  terms.push(`${stat('defensive_touchdowns')} * 6`)

  return `ROUND((${terms.join(' + ')}), 2)`
}

// year_offset RANGE path: the generic SUM(column_name) reducer cannot sum a
// computed expression, so hand-emit the correlated subquery that re-scans the
// projection table directly (outer JOIN aliases are not visible inside a
// subquery), summing the scorer over the offset-expanded year window scoped to
// the same source / week / seas_type discriminators the JOIN enforces.
const projection_points_year_offset_range_sql = ({
  params = {},
  data_view_options = {},
  is_rest_of_season = false
}) => {
  const [min_offset, max_offset] = resolve_year_offset_range(params)
  const { seas_type, week, sourceid, year } = get_default_params({ params })
  const scoring_format = get_projection_scoring_format({
    params,
    data_view_options
  })
  const inner_table = is_rest_of_season
    ? 'ros_projections'
    : 'projections_index'

  const expression = projection_fantasy_points_sql({
    scoring_format,
    column_ref: (name) => `${inner_table}.${name}`,
    position_reference: PROJECTION_POSITION_REFERENCE
  })

  // Mirror select-string's generic correlated-aggregate year basis: correlate
  // to year_reference through the range when a year split exposes it, otherwise
  // cross the source's year_default (params.year) with the offset range.
  const year_reference = data_view_options.year_reference
  let year_predicate
  if (year_reference) {
    year_predicate = `${inner_table}.season_year BETWEEN ${year_reference} + ${min_offset} AND ${year_reference} + ${max_offset}`
  } else {
    const years = []
    for (let offset = min_offset; offset <= max_offset; offset++) {
      years.push(Number(year) + offset)
    }
    year_predicate = `${inner_table}.season_year IN (${years.join(',')})`
  }

  const predicates = [
    `${inner_table}.pid = ${data_view_options.pid_reference}`,
    year_predicate,
    `${inner_table}.sourceid = ${sourceid}`
  ]
  // ros_projections carries no week / seas_type discriminator.
  if (!is_rest_of_season) {
    predicates.push(`${inner_table}.week = ${week}`)
    predicates.push(`${inner_table}.season_type = '${seas_type}'`)
  }

  return `(SELECT SUM(${expression}) FROM ${inner_table} WHERE ${predicates.join(' AND ')})`
}

const player_projected_points_added = {
  column_name: 'pts_added',
  table_alias: league_format_player_projection_values_table_alias,
  source_factory: make_league_format_player_projection_source
}

const player_projected_market_salary = {
  column_name: 'market_salary',
  table_alias: league_format_player_projection_values_table_alias,
  source_factory: make_league_format_player_projection_source
}

const player_projected_salary_adjusted_points_added = {
  column_name: 'salary_adj_pts_added',
  table_alias: league_player_projection_values_table_alias,
  source_factory: make_league_player_projection_source
}

// Projected fantasy points are computed in-query from the projections_index /
// ros_projections raw-stat row (reusing the sourceid-keyed alias + source built
// for the raw-stat columns), so points honor the sourceid projection-source
// param and stay self-consistent with the raw-stat columns. See task
// projected-points-in-query-scoring-source-selection.
const player_projected_points = {
  table_alias: projections_index_table_alias,
  source_factory: make_projections_index_source,
  // Resolve scoring-format weights asynchronously before the (synchronous)
  // select / group-by / where emit; memoized on data_view_options.
  register_ctes: register_projection_scoring_format,
  // Bound per prefix by create_projected_stat: main_select needs the
  // prefix-correct select alias; the year_offset override needs the
  // prefix-correct table (projections_index vs ros_projections).
  method_factories: {
    main_select:
      ({ select_as }) =>
      ({ table_name, params, column_index, data_view_options = {} }) => {
        const expression = projection_fantasy_points_sql({
          scoring_format: get_projection_scoring_format({
            params,
            data_view_options
          }),
          column_ref: (name) => `"${table_name}"."${name}"`,
          position_reference: PROJECTION_POSITION_REFERENCE
        })
        return [`${expression} AS "${select_as()}_${column_index}"`]
      },
    // The scorer references the joined projection alias's non-aggregated stat
    // columns, so group by the whole expression to satisfy Postgres (the
    // projection join is 1:1 per player, so this never splits a row).
    main_group_by:
      () =>
      ({ table_name, params, data_view_options = {} }) => [
        projection_fantasy_points_sql({
          scoring_format: get_projection_scoring_format({
            params,
            data_view_options
          }),
          column_ref: (name) => `"${table_name}"."${name}"`,
          position_reference: PROJECTION_POSITION_REFERENCE
        })
      ],
    // Preserve filter support: a where/having clause on projected points emits
    // the scorer expression (the legacy column filtered on its `total` column).
    main_where:
      () =>
      ({ table_name, params, data_view_options = {} }) =>
        projection_fantasy_points_sql({
          scoring_format: get_projection_scoring_format({
            params,
            data_view_options
          }),
          column_ref: (name) => `"${table_name}"."${name}"`,
          position_reference: PROJECTION_POSITION_REFERENCE
        }),
    main_select_string_year_offset_range:
      ({ is_rest_of_season }) =>
      ({ params = {}, data_view_options = {} }) =>
        projection_points_year_offset_range_sql({
          params,
          data_view_options,
          is_rest_of_season
        })
  }
}

const projections_index_base = (column_name) => ({
  column_name,
  table_alias: projections_index_table_alias,
  source_factory: make_projections_index_source
})

const create_projected_stat = (base, stat_name) => {
  const { source_factory, method_factories, ...rest } = base
  const prefixes = ['week', 'season', 'rest_of_season']
  return prefixes.reduce((acc, prefix) => {
    const is_rest_of_season = prefix === 'rest_of_season'
    const select_as = () => `${prefix}_projected_${stat_name}`
    const definition = {
      ...rest,
      select_as,
      source: source_factory({ is_rest_of_season }),
      get_cache_info: get_cache_info_for_player_projected_stats
    }
    // Columns that emit prefix-aware methods (player_projected_points) bind them
    // here so each prefix gets the right select alias / projection table. Other
    // stats declare no method_factories and are unaffected.
    if (method_factories) {
      for (const [method, factory] of Object.entries(method_factories)) {
        definition[method] = factory({ select_as, is_rest_of_season })
      }
    }
    acc[`player_${prefix}_projected_${stat_name}`] = definition
    return acc
  }, {})
}

const projected_stat_column_defintions = {
  ...create_projected_stat(player_projected_market_salary, 'market_salary'),
  ...create_projected_stat(
    player_projected_salary_adjusted_points_added,
    'salary_adjusted_points_added'
  ),
  ...create_projected_stat(player_projected_points_added, 'points_added'),
  ...create_projected_stat(player_projected_points, 'points'),
  ...create_projected_stat(
    projections_index_base('passing_attempts'),
    'pass_atts'
  ),
  ...create_projected_stat(
    projections_index_base('passing_completions'),
    'pass_comps'
  ),
  ...create_projected_stat(projections_index_base('passing_yards'), 'pass_yds'),
  ...create_projected_stat(
    projections_index_base('passing_touchdowns'),
    'pass_tds'
  ),
  ...create_projected_stat(
    projections_index_base('passing_interceptions'),
    'pass_ints'
  ),
  ...create_projected_stat(
    projections_index_base('rushing_attempts'),
    'rush_atts'
  ),
  ...create_projected_stat(projections_index_base('rushing_yards'), 'rush_yds'),
  ...create_projected_stat(
    projections_index_base('rushing_touchdowns'),
    'rush_tds'
  ),
  ...create_projected_stat(
    projections_index_base('fumbles_lost'),
    'fumbles_lost'
  ),
  ...create_projected_stat(projections_index_base('targets'), 'targets'),
  ...create_projected_stat(projections_index_base('receptions'), 'recs'),
  ...create_projected_stat(
    projections_index_base('receiving_yards'),
    'rec_yds'
  ),
  ...create_projected_stat(
    projections_index_base('receiving_touchdowns'),
    'rec_tds'
  )
}

export default {
  player_season_projected_inflation_adjusted_market_salary: {
    column_name: 'market_salary_adj',
    table_alias: league_player_projection_values_table_alias,
    select_as: () => 'player_season_projected_inflation_adjusted_market_salary',
    source: make_league_player_projection_source(),
    get_cache_info: get_cache_info_for_player_projected_stats
  },

  ...projected_stat_column_defintions
}
