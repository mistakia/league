import {
  DEFAULT_SCORING_FORMAT_ID,
  DEFAULT_LEAGUE_FORMAT_ID
} from '#libs-shared'
import {
  current_season,
  external_data_sources,
  nfl_season_types,
  projected_base_stats
} from '#constants'
import {
  sql_enum_param,
  sql_integer_param
} from '#libs-server/data-views/sanitize-sql-param.mjs'
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
    // An nfl_week_id that did not parse yields no week, not week 0. The
    // identifier list was empty or malformed; inventing a period for it is what
    // the sentinel did.
    week = parsed ? parsed.week : null
    seas_type = parsed ? parsed.seas_type : 'REG'
  } else {
    year = Array.isArray(params.year)
      ? params.year[0]
      : params.year || current_season.year
    // Null, not 0, when the request carries no week. Only the week-scoped
    // sources read this, and they declare a player_year_week grain that the
    // request boundary refuses under a weekless cell -- so a null here is a
    // state the period tables never see. `|| 0` instead named a period that no
    // table has expressed since the period split.
    week = Array.isArray(params.week) ? params.week[0] : (params.week ?? null)
    seas_type = Array.isArray(params.seas_type)
      ? params.seas_type[0]
      : params.seas_type || 'REG'
    nfl_week = null
  }

  const scoring_format_id =
    params.scoring_format_id || DEFAULT_SCORING_FORMAT_ID
  const league_format_id = params.league_format_id || DEFAULT_LEAGUE_FORMAT_ID
  const league_id = params.league_id || 1

  // Projection source (projections_index / rest_of_season_projections only).
  // Defaults to the AVERAGE consensus so a column with no `sourceid` param is
  // unchanged.
  //
  // The persisted param KEY is `sourceid` and deliberately did NOT move with the
  // COLUMN, which is now `source_id`: saved views persist the key, so renaming it
  // silently drops every filter a user already set (21 occurrences across 2
  // production views). See the note in
  // app/core/data-views-fields/projected-table-fields.js. Everything below this
  // read names the conformed COLUMN.
  const sourceid_param = Array.isArray(params.sourceid)
    ? params.sourceid[0]
    : params.sourceid
  const source_id =
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
    source_id
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

// The three periods of the RAW-STAT fan-out, each its own table. Only the week
// table has a week / season_type discriminator; the other two are grained
// (source_id, pid, season_year), so week = 0 is not a period they can express.
const PROJECTION_PERIOD_TABLES = {
  week: 'projections_index',
  season: 'season_projections_index',
  rest_of_season: 'rest_of_season_projections'
}

// Each period gets its OWN alias, and that is load-bearing rather than tidy.
// Two columns whose table_alias hashes equal collapse into ONE join group
// carrying only the seeding column's table and predicates. All three prefixes
// shared a single alias until 2026-08-29, so a view holding two of them emitted
// one join and selected the same expression under both headers -- proved live,
// with no error and no failing golden, because no golden mixes prefixes. It is
// the same class the league_format aliases below record. Three tables make it
// unavoidable rather than latent.
//
// source_id is part of every key so two projection columns at the same period
// but different sources do not collapse into one shared JOIN (which could carry
// only one source_id predicate). The week key adds week / seas_type; the period
// keys cannot, because those columns do not exist on their tables.
const projections_index_period_table_alias =
  (period) =>
  ({ params = {} }) => {
    const p = get_default_params({ params })
    const key = period === 'week' ? get_alias_key(p) : String(p.year)
    return get_table_hash(
      `${PROJECTION_PERIOD_TABLES[period]}_${key}_source_${p.source_id}`
    )
  }

const league_player_projection_values_table_alias = ({ params = {} }) => {
  const p = get_default_params({ params })
  return get_table_hash(
    `league_player_projection_values_${get_alias_key(p)}_league_${p.league_id}`
  )
}

// The two period tables carry no week column, so their aliases key on year and
// league only. Including the week dimension the way the week table's alias does
// would split one join into one-per-requested-week for no benefit.
const league_player_season_projection_values_table_alias = ({
  params = {}
}) => {
  const p = get_default_params({ params })
  return get_table_hash(
    `league_player_season_projection_values_${p.year}_league_${p.league_id}`
  )
}

const league_player_rest_of_season_projection_values_table_alias = ({
  params = {}
}) => {
  const p = get_default_params({ params })
  return get_table_hash(
    `league_player_rest_of_season_projection_values_${p.year}_league_${p.league_id}`
  )
}

// The per-week table's alias keys on the request's week, as it always did.
//
// It used to need a PERIOD component too, because every period lived in this
// one table's `week` column and each period column pinned its own sentinel:
// two columns hashing to the same alias collapse into ONE join group carrying
// only the seeding column's predicate, so a view holding both the week and the
// rest-of-season variant of a stat rendered one period's value under the
// other's header, with no error and no failing test. That whole class is gone
// -- each period is a different TABLE now, and two different tables cannot
// share a join group.
const league_format_player_projection_values_table_alias = ({
  params = {}
}) => {
  const p = get_default_params({ params })
  return get_table_hash(
    `league_format_player_projection_values_${get_alias_key(p)}_${p.league_format_id}`
  )
}

// The two league-format period tables carry no week column, so their aliases
// key on year and format only. Including the week dimension the way the week
// table's alias does would split one join into one-per-requested-week for no
// benefit -- the same reasoning as the league_player period aliases above.
const league_format_period_projection_values_table_alias_for =
  (table) =>
  ({ params = {} }) => {
    const p = get_default_params({ params })
    return get_table_hash(`${table}_${p.year}_${p.league_format_id}`)
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
  join_year_column = 'year',
  additional_conditions
}) => {
  const { players_query, pid_reference, year_reference, week_reference } =
    query_context
  const join_method = join_type === 'INNER' ? 'innerJoin' : 'leftJoin'
  const year = params.year || current_season.year
  // No week default. Every source that passes `join_week: true` declares
  // `grain: 'player_year_week'`, so source-attach admits it only under a cell
  // carrying a week axis, and `week_reference` is therefore always present
  // below. A request with no week axis is refused at the boundary by
  // validate_source_attach_compatibility before reaching here.
  //
  // What stood here was `params.week || 0`, the last sentinel default in this
  // file. Week 0 was the season key while every period shared one table, so the
  // fallback returned a season value under a week header; once the periods
  // split it pinned the join to a week the narrowed tables cannot hold, so the
  // column read blank instead. Wrong-period and silently-empty are the same
  // defect, and neither is expressible now that the grain is declared.
  const week = params.week

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
          // Spliced in bare value position from request params, so each entry
          // is coerced to an integer here -- a non-integer is a 400 rather than
          // reaching SQL text.
          const year_array = (Array.isArray(year) ? year : [year]).map(
            (value) => sql_integer_param({ value, param_name: 'year' })
          )
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
        // The weekly tables are smallint since the period split, so the week
        // reference compares directly with no VARCHAR cast on either side.
        this.andOn(db.raw(`${table_alias}.week = ${week_reference}`))
        if (params.week) {
          const week_array = Array.isArray(week)
            ? week.map(String)
            : [String(week)]
          if (week_array.length) {
            // Bound rather than interpolated: every week column these sources
            // reach is smallint now, and a bound unknown-typed literal is
            // inferred to it, where a hand-built literal list is a shape each
            // retype can break silently.
            this.andOn(
              db.raw(
                `${table_alias}.week IN (${week_array.map(() => '?').join(',')})`,
                week_array
              )
            )
          }
        }
      } else {
        // No week ROW AXIS, so the week comes from the param -- a flat player
        // row pinned to one week, which is a shipped shape. `week` is
        // guaranteed non-null here: every source passing join_week declares
        // `requires_week`, and the boundary refuses a request that resolves no
        // week, so the sentinel default this used to carry is unreachable
        // rather than merely unwise.
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
  // These rows are keyed by week, so a request that resolves no week has no
  // row to join. Refused at the boundary by validate_week_requirement rather
  // than defaulted -- see that module for why grain is the wrong instrument
  // here (it cannot see a week PARAM, and a flat player-row table with an
  // explicit week is a shipped shape).
  requires_week: true,
  table: 'league_player_projection_values',
  // Conformed to season_year. param-utils/select-string default year_column to
  // 'year' when a source omits key_columns, which would emit a correlated
  // predicate on a column that no longer exists.
  key_columns: { year: 'season_year' },
  attach_owns_join: true,
  year_default: (params) => [get_default_params({ params }).year],
  extra_predicates: (params) => {
    const { league_id, week } = get_default_params({ params })
    // The week entry is omitted when no PARAM resolves a week. That happens
    // when the week comes from the row axis instead, and select-string then
    // correlates the subquery's week to the week reference -- a literal here
    // would be `String(null)`, a 22P02 against a smallint column.
    return [
      { column: 'lid', value: league_id },
      ...(week == null ? [] : [{ column: 'week', value: String(week) }])
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
      join_year_column: 'season_year',
      join_week: true,
      // This table's week was narrowed to smallint, so it compares to the
      // smallint week_reference directly -- casting either side to VARCHAR is
      // what breaks it.
      additional_conditions() {
        this.andOn(`${table_alias}.lid`, '=', db.raw('?', [league_id]))
      }
    })
  }
})

// Season and rest-of-season share a shape: grained (pid, lid, year) with no week
// column. `join_week: false` is load-bearing rather than tidy -- apply_projected_join
// defaults it to true and falls back to `params.week || 0`, so omitting it emits a
// week predicate against a column that does not exist.
const make_league_player_period_projection_source =
  ({ table }) =>
  () => ({
    grain: 'player',
    table,
    attach_owns_join: true,
    // season_year, not year -- same reason as make_projections_index_source: the
    // generic year_offset_range correlated-subquery path re-scans source.table
    // directly and needs the real column name.
    key_columns: { year: 'season_year' },
    year_default: (params) => [get_default_params({ params }).year],
    extra_predicates: (params) => {
      const { league_id } = get_default_params({ params })
      return [{ column: 'lid', value: league_id }]
    },
    attach: ({ query_context, params, table_alias, join_type }) => {
      const { league_id } = get_default_params({ params })
      apply_projected_join({
        query_context,
        params,
        table_alias,
        join_type,
        join_table_clause: `${table} as ${table_alias}`,
        join_year: true,
        join_week: false,
        // These two tables are conformed to season_year. apply_projected_join
        // defaults join_year_column to 'year', which would emit a predicate on a
        // column that does not exist here.
        join_year_column: 'season_year',
        additional_conditions() {
          this.andOn(`${table_alias}.lid`, '=', db.raw('?', [league_id]))
        }
      })
    }
  })

const make_league_player_season_projection_source =
  make_league_player_period_projection_source({
    table: 'league_player_season_projection_values'
  })

const make_league_player_rest_of_season_projection_source =
  make_league_player_period_projection_source({
    table: 'league_player_rest_of_season_projection_values'
  })

// The PER-WEEK league-format source. It follows the request's week param and
// nothing else -- the season and rest-of-season periods are their own tables
// below, so this source no longer carries a period parameter and cannot be
// pointed at a sentinel.
const make_league_format_player_projection_source = () => ({
  grain: 'player',
  // Week-keyed rows -- see the league_player source above.
  requires_week: true,
  table: 'league_format_player_projection_values',
  // Conformed to season_year -- see the note on the league_player source above.
  key_columns: { year: 'season_year' },
  attach_owns_join: true,
  year_default: (params) => [get_default_params({ params }).year],
  extra_predicates: (params) => {
    const { league_format_id, week } = get_default_params({ params })
    // Omitted when no param resolves a week -- see the league_player source.
    return [
      { column: 'league_format_id', value: league_format_id },
      ...(week == null ? [] : [{ column: 'week', value: String(week) }])
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
      join_year_column: 'season_year',
      join_week: true,
      additional_conditions() {
        this.andOn(
          `${table_alias}.league_format_id`,
          '=',
          db.raw('?', [league_format_id])
        )
      }
    })
  }
})

// Season and rest-of-season share a shape: grained (pid, league_format_id,
// season_year) with no week column. `join_week: false` is load-bearing rather
// than tidy -- apply_projected_join defaults it to true and falls back to
// `params.week || 0`, so omitting it emits a week predicate against a column
// that does not exist. Mirrors make_league_player_period_projection_source.
const make_league_format_player_period_projection_source =
  ({ table }) =>
  () => ({
    grain: 'player',
    table,
    attach_owns_join: true,
    key_columns: { year: 'season_year' },
    year_default: (params) => [get_default_params({ params }).year],
    extra_predicates: (params) => {
      const { league_format_id } = get_default_params({ params })
      return [{ column: 'league_format_id', value: league_format_id }]
    },
    attach: ({ query_context, params, table_alias, join_type }) => {
      const { league_format_id } = get_default_params({ params })
      apply_projected_join({
        query_context,
        params,
        table_alias,
        join_type,
        join_table_clause: `${table} as ${table_alias}`,
        join_year: true,
        join_week: false,
        join_year_column: 'season_year',
        additional_conditions() {
          this.andOn(
            `${table_alias}.league_format_id`,
            '=',
            db.raw('?', [league_format_id])
          )
        }
      })
    }
  })

const make_league_format_player_season_projection_source =
  make_league_format_player_period_projection_source({
    table: 'league_format_player_season_projection_values'
  })

const make_league_format_player_rest_of_season_projection_source =
  make_league_format_player_period_projection_source({
    table: 'league_format_player_rest_of_season_projection_values'
  })

// The RAW-STAT source, one arm per period. `period` is three-valued rather than
// an `is_rest_of_season` boolean because the set has three members and a boolean
// cannot name three. Follows make_league_player_period_projection_source above:
// one parameterized factory bound to concrete tables, not a factory per period.
const make_projections_index_source = ({ period = 'week' } = {}) => {
  const table = PROJECTION_PERIOD_TABLES[period]
  const is_week = period === 'week'

  return {
    grain: 'player',
    // Only the WEEK arm is week-keyed. season_projections_index and
    // rest_of_season_projections are grained (source_id, pid, season_year) with
    // no week column at all, so they require nothing and stay resolvable under
    // every request shape.
    requires_week: is_week,
    table,
    attach_owns_join: true,
    // season_year, not year -- see select-string.mjs's source.key_columns.year
    // read (generic year_offset_range correlated-subquery path re-scans
    // source.table directly and needs the real column name). All three tables
    // conform to season_year.
    key_columns: { year: 'season_year' },
    year_default: (params) => [get_default_params({ params }).year],
    extra_predicates: (params) => {
      const { seas_type, week, source_id } = get_default_params({ params })
      // season_projections_index and rest_of_season_projections are both keyed
      // (source_id, pid, season_year) with no week / season_type discriminator,
      // so their subqueries pin source_id only.
      if (!is_week) {
        return [{ column: 'source_id', value: source_id }]
      }
      // projections_index.week is smallint (numeric); seas_type is an enum. The
      // offset-expanded year window plus source_id + seas_type + week
      // discriminates the source even when the JOIN used nfl_week_id.
      return [
        { column: 'source_id', value: source_id },
        // Omitted when no param resolves a week -- see the league_player
        // source above.
        ...(week == null ? [] : [{ column: 'week', value: week }]),
        { column: 'season_type', value: seas_type }
      ]
    },
    attach: ({ query_context, params, table_alias, join_type }) => {
      const { seas_type, nfl_week, source_id } = get_default_params({ params })
      apply_projected_join({
        query_context,
        params,
        table_alias,
        join_type,
        join_table_clause: `${table} as ${table_alias}`,
        join_year: true,
        // MANDATORY false on both period arms. apply_projected_join defaults
        // join_week to true and falls back to `params.week || 0`, so omitting
        // it emits a week predicate against a column neither period table has.
        join_week: is_week,
        join_year_column: 'season_year',
        additional_conditions() {
          // source_id discriminates the projection provider on all three
          // tables. The period tables carry no week / season_type /
          // nfl_week_id columns, so they stop here.
          this.andOn(`${table_alias}.source_id`, '=', source_id)
          if (!is_week) return
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
  }
}

// --- Projected fantasy points in-query scorer ------------------------------
//
// player_projected_points computes its value from the projections_index /
// rest_of_season_projections raw-stat row using the selected scoring format's weights,
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
  period = 'week'
}) => {
  const [min_offset, max_offset] = resolve_year_offset_range(params)
  const {
    seas_type: raw_seas_type,
    week: raw_week,
    source_id,
    year
  } = get_default_params({ params })
  const scoring_format = get_projection_scoring_format({
    params,
    data_view_options
  })
  const is_week = period === 'week'
  const inner_table = PROJECTION_PERIOD_TABLES[period]

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
    `${inner_table}.source_id = ${source_id}`
  ]
  // A three-way split, NOT a deletion: this subquery fans player_projected_points
  // across all three prefixes, and dropping the predicate outright would strip
  // the week discriminator from the week prefix. Neither period table carries a
  // week or season_type column.
  if (is_week) {
    // The week basis mirrors the year basis directly above: correlate to
    // week_reference when a week SPLIT exposes one, and otherwise splice the
    // param. Only the param path reaches sql_integer_param, which is the point
    // -- a null week is not a value to sanitize, it is a request that resolved
    // its week from the row axis instead. Passing null through here raised
    // "invalid data view param: week" once the `|| 0` sentinel went, on the
    // year_offset + week-axis shape that no golden covers.
    //
    // `week` splices into BARE value position and `seas_type` inside quotes,
    // both straight from request params on the unauthenticated
    // /data-views/search path, so they are sanitized here rather than inlined.
    // `source_id` and `year` are already Number-coerced by get_default_params.
    const week_reference = data_view_options.week_reference
    if (week_reference) {
      predicates.push(`${inner_table}.week = ${week_reference}`)
    } else {
      const week = sql_integer_param({ value: raw_week, param_name: 'week' })
      predicates.push(`${inner_table}.week = ${week}`)
    }
    const seas_type = sql_enum_param({
      value: raw_seas_type,
      param_name: 'seas_type',
      allowed: nfl_season_types
    })
    predicates.push(`${inner_table}.season_type = '${seas_type}'`)
  }

  return `(SELECT SUM(${expression}) FROM ${inner_table} WHERE ${predicates.join(' AND ')})`
}

// The league-format valuation columns, registered EXPLICITLY per period rather
// than fanned out by create_projected_stat. Three reasons, and the first two are
// forced:
//
//   Each period is a different TABLE, so there is no single source factory to
//   fan. The fan-out shares one alias and one source across all three prefixes,
//   which is precisely what produced the latent defect the league_player block
//   below records -- every prefix resolved to whatever params.week was.
//
//   Each period carries a different COLUMN. A weekly points-added is one signed
//   number; the two period aggregates each publish a positive and a net, and
//   their two market salaries are shares of different pools.
//
//   And the WEEK period has no market salary at all. A price is a
//   season-context quantity -- a share of the discretionary cap for the year --
//   so `player_week_projected_market_salary` is retired rather than repointed.
//   Any saved view carrying it drops that one column; nothing else in the view
//   is affected.
const make_league_format_projection_column = ({
  column_name,
  select_as,
  table_alias,
  source
}) => ({
  column_name,
  table_alias,
  select_as: () => select_as,
  source,
  get_cache_info: get_cache_info_for_player_projected_stats
})

const league_format_season_alias =
  league_format_period_projection_values_table_alias_for(
    'league_format_player_season_projection_values'
  )

const league_format_rest_of_season_alias =
  league_format_period_projection_values_table_alias_for(
    'league_format_player_rest_of_season_projection_values'
  )

// Positive is the perfect-optionality bound -- what a player adds when you can
// bench him below replacement. Net is the no-optionality bound -- what he adds
// when you start him every week and eat the bad ones. They bracket reality
// rather than competing, and they are not a rescale of one another: a player can
// carry a positive positive and a negative net. The unsuffixed id is the
// positive one, which is the convention this family already used for
// rest-of-season.
const league_format_period_column_definitions = {
  player_week_projected_points_added: make_league_format_projection_column({
    column_name: 'projected_points_added_net',
    select_as: 'week_projected_points_added',
    table_alias: league_format_player_projection_values_table_alias,
    source: make_league_format_player_projection_source()
  }),
  player_season_projected_points_added: make_league_format_projection_column({
    column_name: 'projected_points_added_positive',
    select_as: 'season_projected_points_added',
    table_alias: league_format_season_alias,
    source: make_league_format_player_season_projection_source()
  }),
  player_season_projected_points_added_net:
    make_league_format_projection_column({
      column_name: 'projected_points_added_net',
      select_as: 'season_projected_points_added_net',
      table_alias: league_format_season_alias,
      source: make_league_format_player_season_projection_source()
    }),
  player_rest_of_season_projected_points_added:
    make_league_format_projection_column({
      column_name: 'projected_points_added_positive',
      select_as: 'rest_of_season_projected_points_added',
      table_alias: league_format_rest_of_season_alias,
      source: make_league_format_player_rest_of_season_projection_source()
    }),
  player_rest_of_season_projected_points_added_net:
    make_league_format_projection_column({
      column_name: 'projected_points_added_net',
      select_as: 'rest_of_season_projected_points_added_net',
      table_alias: league_format_rest_of_season_alias,
      source: make_league_format_player_rest_of_season_projection_source()
    }),
  // The token on a market salary names WHICH POOL the share is of, not a sign.
  // get_positive_part_total builds every denominator from positive values only,
  // and calculate-prices floors every price at zero, so the net variant is a
  // share of the positive-net pool and is still non-negative.
  player_season_projected_market_salary: make_league_format_projection_column({
    column_name: 'market_salary_positive',
    select_as: 'season_projected_market_salary',
    table_alias: league_format_season_alias,
    source: make_league_format_player_season_projection_source()
  }),
  player_season_projected_market_salary_net:
    make_league_format_projection_column({
      column_name: 'market_salary_net',
      select_as: 'season_projected_market_salary_net',
      table_alias: league_format_season_alias,
      source: make_league_format_player_season_projection_source()
    }),
  player_rest_of_season_projected_market_salary:
    make_league_format_projection_column({
      column_name: 'market_salary_positive',
      select_as: 'rest_of_season_projected_market_salary',
      table_alias: league_format_rest_of_season_alias,
      source: make_league_format_player_rest_of_season_projection_source()
    }),
  player_rest_of_season_projected_market_salary_net:
    make_league_format_projection_column({
      column_name: 'market_salary_net',
      select_as: 'rest_of_season_projected_market_salary_net',
      table_alias: league_format_rest_of_season_alias,
      source: make_league_format_player_rest_of_season_projection_source()
    })
}

// Registered explicitly per period below rather than fanned out by
// create_projected_stat. The fan-out shares one table_alias and one source across
// all three prefixes, which is what produced the latent defect here: every prefix
// resolved to whatever params.week was (default 0), so the season and
// rest-of-season columns silently returned a per-week value instead of their own
// period. Now each period reads its own table.
const player_projected_points_added_including_cap_savings_periods = {
  player_week_projected_points_added_positive_including_cap_savings: {
    column_name: 'projected_points_added_positive_including_cap_savings',
    table_alias: league_player_projection_values_table_alias,
    select_as: () => 'week_points_added_positive_including_cap_savings',
    source: make_league_player_projection_source(),
    get_cache_info: get_cache_info_for_player_projected_stats
  },
  player_season_projected_points_added_positive_including_cap_savings: {
    column_name: 'projected_points_added_positive_including_cap_savings',
    table_alias: league_player_season_projection_values_table_alias,
    select_as: () => 'season_points_added_positive_including_cap_savings',
    source: make_league_player_season_projection_source(),
    get_cache_info: get_cache_info_for_player_projected_stats
  },
  player_rest_of_season_projected_points_added_positive_including_cap_savings: {
    column_name: 'projected_points_added_positive_including_cap_savings',
    table_alias: league_player_rest_of_season_projection_values_table_alias,
    select_as: () =>
      'rest_of_season_points_added_positive_including_cap_savings',
    source: make_league_player_rest_of_season_projection_source(),
    get_cache_info: get_cache_info_for_player_projected_stats
  }
}

// Projected fantasy points are computed in-query from the projections_index /
// rest_of_season_projections raw-stat row (reusing the sourceid-keyed alias + source built
// for the raw-stat columns), so points honor the source_id projection-source
// param and stay self-consistent with the raw-stat columns. See task
// projected-points-in-query-scoring-source-selection.
const player_projected_points = {
  table_alias_factory: projections_index_period_table_alias,
  source_factory: make_projections_index_source,
  // Resolve scoring-format weights asynchronously before the (synchronous)
  // select / group-by / where emit; memoized on data_view_options.
  register_ctes: register_projection_scoring_format,
  // Bound per prefix by create_projected_stat: main_select needs the
  // prefix-correct select alias; the year_offset override needs the
  // prefix-correct table, one per period.
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
      ({ period }) =>
      ({ params = {}, data_view_options = {} }) =>
        projection_points_year_offset_range_sql({
          params,
          data_view_options,
          period
        })
  }
}

const projections_index_base = (column_name) => ({
  column_name,
  table_alias_factory: projections_index_period_table_alias,
  source_factory: make_projections_index_source
})

// The RAW-STAT fan-out. Every column it builds reads one of the three period
// tables, which share a column shape under a period switch. The league-format
// valuation columns are NOT fanned out here -- see
// league_format_period_column_definitions above for why they cannot be.
//
// The table_alias is bound PER PERIOD, not shared across the fan. A shared one
// collapsed all three prefixes into a single join; see the note on
// projections_index_period_table_alias.
const create_projected_stat = (base, stat_name) => {
  const { source_factory, table_alias_factory, method_factories, ...rest } =
    base
  const periods = ['week', 'season', 'rest_of_season']
  return periods.reduce((acc, period) => {
    const select_as = () => `${period}_projected_${stat_name}`
    const definition = {
      ...rest,
      select_as,
      table_alias: table_alias_factory(period),
      source: source_factory({ period }),
      get_cache_info: get_cache_info_for_player_projected_stats
    }
    // Columns that emit period-aware methods (player_projected_points) bind them
    // here so each period gets the right select alias / projection table. Other
    // stats declare no method_factories and are unaffected.
    if (method_factories) {
      for (const [method, factory] of Object.entries(method_factories)) {
        definition[method] = factory({ select_as, period })
      }
    }
    acc[`player_${period}_projected_${stat_name}`] = definition
    return acc
  }, {})
}

const projected_stat_column_defintions = {
  ...league_format_period_column_definitions,
  ...player_projected_points_added_including_cap_savings_periods,
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
  // This was market_salary_adj until 2026-08-18. It moved to the season table
  // first -- it was non-null on the week='0' row only and NULL on every other
  // week, so it was a sentinel-only column on a per-week table -- and then took
  // a name that says which POOL it prices against: money teams can still bid,
  // each team's availableCap minus min_bid per open space. Its minimal pair is
  // market_salary -> projected_positive_salary_at_full_cap.
  player_season_projected_positive_salary_at_available_cap: {
    column_name: 'projected_positive_salary_at_available_cap',
    table_alias: league_player_season_projection_values_table_alias,
    select_as: () => 'player_season_projected_positive_salary_at_available_cap',
    source: make_league_player_season_projection_source(),
    get_cache_info: get_cache_info_for_player_projected_stats
  },

  ...projected_stat_column_defintions
}
