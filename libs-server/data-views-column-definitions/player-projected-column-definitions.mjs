import {
  DEFAULT_SCORING_FORMAT_ID,
  DEFAULT_LEAGUE_FORMAT_ID
} from '#libs-shared'
import { current_season, external_data_sources } from '#constants'
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

const scoring_format_player_projection_points_table_alias = ({
  params = {}
}) => {
  const p = get_default_params({ params })
  return get_table_hash(
    `scoring_format_player_projection_points_${get_alias_key(p)}_${p.scoring_format_id}`
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
          key_columns: { year: 'year' },
          params,
          ref: table_alias
        })
      } else if (year_reference) {
        this.andOn(db.raw(`${table_alias}.year = ${year_reference}`))
        if (params.year) {
          const year_array = Array.isArray(year) ? year : [year]
          if (year_array.length) {
            this.andOn(
              db.raw(`${table_alias}.year IN (${year_array.join(',')})`)
            )
          }
        }
      } else {
        this.andOn(
          `${table_alias}.year`,
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

const make_scoring_format_player_projection_source = ({
  is_rest_of_season = false
} = {}) => ({
  grain: 'player',
  table: 'scoring_format_player_projection_points',
  attach_owns_join: true,
  year_default: (params) => [get_default_params({ params }).year],
  extra_predicates: (params) => {
    const { scoring_format_id, week } = get_default_params({ params })
    return [
      { column: 'scoring_format_id', value: scoring_format_id },
      { column: 'week', value: is_rest_of_season ? 'ros' : String(week) }
    ]
  },
  attach: ({ query_context, params, table_alias, join_type }) => {
    const { scoring_format_id } = get_default_params({ params })
    apply_projected_join({
      query_context,
      params,
      table_alias,
      join_type,
      join_table_clause: `scoring_format_player_projection_points as ${table_alias}`,
      join_year: true,
      join_week: !is_rest_of_season,
      cast_join_week_to_string: true,
      additional_conditions() {
        this.andOn(
          `${table_alias}.scoring_format_id`,
          '=',
          db.raw('?', [scoring_format_id])
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
      { column: 'seas_type', value: seas_type }
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
          this.andOn(`${table_alias}.seas_type`, '=', db.raw('?', [seas_type]))
        }
      }
    })
  }
})

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

const player_projected_points = {
  column_name: 'total',
  table_alias: scoring_format_player_projection_points_table_alias,
  source_factory: make_scoring_format_player_projection_source
}

const projections_index_base = (column_name) => ({
  column_name,
  table_alias: projections_index_table_alias,
  source_factory: make_projections_index_source
})

const create_projected_stat = (base, stat_name) => {
  const { source_factory, ...rest } = base
  const prefixes = ['week', 'season', 'rest_of_season']
  return prefixes.reduce((acc, prefix) => {
    const is_rest_of_season = prefix === 'rest_of_season'
    acc[`player_${prefix}_projected_${stat_name}`] = {
      ...rest,
      select_as: () => `${prefix}_projected_${stat_name}`,
      source: source_factory({ is_rest_of_season }),
      get_cache_info: get_cache_info_for_player_projected_stats
    }
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
  ...create_projected_stat(projections_index_base('pa'), 'pass_atts'),
  ...create_projected_stat(projections_index_base('pc'), 'pass_comps'),
  ...create_projected_stat(projections_index_base('py'), 'pass_yds'),
  ...create_projected_stat(projections_index_base('tdp'), 'pass_tds'),
  ...create_projected_stat(projections_index_base('ints'), 'pass_ints'),
  ...create_projected_stat(projections_index_base('ra'), 'rush_atts'),
  ...create_projected_stat(projections_index_base('ry'), 'rush_yds'),
  ...create_projected_stat(projections_index_base('tdr'), 'rush_tds'),
  ...create_projected_stat(projections_index_base('fuml'), 'fumbles_lost'),
  ...create_projected_stat(projections_index_base('trg'), 'targets'),
  ...create_projected_stat(projections_index_base('rec'), 'recs'),
  ...create_projected_stat(projections_index_base('recy'), 'rec_yds'),
  ...create_projected_stat(projections_index_base('tdrec'), 'rec_tds')
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
