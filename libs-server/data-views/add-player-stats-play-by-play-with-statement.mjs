import db from '#db'
import { data_views_constants } from '#libs-shared'
import apply_play_by_play_column_params_to_query from '#libs-server/apply-play-by-play-column-params-to-query.mjs'
import get_play_by_play_default_params from '#libs-server/data-views/get-play-by-play-default-params.mjs'
import get_effective_years from '#libs-server/data-views/get-effective-years.mjs'
import { normalize_career_year_range } from '#libs-server/data-views/param-utils.mjs'
import {
  FACT_SOURCES,
  subject_id_expression
} from '#libs-server/data-views/measure/fact-source-registry.mjs'

// One scan builder over `nfl_plays`, parameterized by how the fact reaches its
// subject. The registry names the two shapes this file emits:
//
//   single_role    the play NAMES the subject in one of its role columns, so
//                  the subject id is a COALESCE over that list and a play with
//                  no matching role groups harmlessly under a NULL pid.
//   cohort_member  the play names a TEAM, so the subject comes off the expanded
//                  members row. The expansion multiplies each team play across
//                  every player who appeared in that game for that team, which
//                  is what puts a team total in scope of a player-grain group
//                  and makes a share an ordinary two-accumulator measure.
//
// Two things differ for a cohort scan and both are load-bearing. The role list
// becomes a ROW RESTRICTION rather than a subject expression -- the denominator
// must count only plays of the measured kind, so a share over targets counts
// team TARGETS and not team plays. And the members table carries its own season
// column, which has to be restricted alongside the plays table or the expansion
// crosses seasons.
export const add_player_stats_play_by_play_with_statement = ({
  query,
  params = {},
  with_table_name,
  having_clauses = [],
  select_strings = [],
  role_columns,
  row_axes = [],
  data_view_options = {},
  fact_source = FACT_SOURCES.plays
}) => {
  if (!with_table_name) {
    throw new Error('with_table_name is required')
  }

  const default_params = get_play_by_play_default_params({ params })

  const is_cohort = fact_source.subject_attribution === 'cohort_member'
  const cohort_expansion = fact_source.cohort_expansion

  const ordered_pid_columns_string = role_columns.includes('fumble_lost_pid')
    ? [
        'fumble_lost_pid',
        ...role_columns.filter((col) => col !== 'fumble_lost_pid')
      ].join(', ')
    : role_columns.join(', ')

  const subject_id = is_cohort
    ? subject_id_expression({ fact_source }).expression
    : `COALESCE(${ordered_pid_columns_string})`

  // The cohort subject id is a plain qualified identifier, so hand it to knex
  // rather than to db.raw and let it quote the way every other reference here
  // is quoted -- a raw fragment emits `pg.pid` where the rest of the statement
  // emits `"pg"."pid"`, which is the same SQL and a different golden.
  const with_query = db('nfl_plays')
    .select(is_cohort ? subject_id : db.raw(`${subject_id} as pid`))
    .whereNot('play_type', 'NOPL')

  if (is_cohort) {
    cohort_expansion.join(with_query)
    with_query.where(function () {
      for (const pid_column of role_columns) {
        this.orWhereNotNull(pid_column)
      }
    })
  }
  // TODO the same restriction could help single_role performance, but there it
  // only removes rows that already group under a NULL pid, so it is a
  // measurable change rather than a free one.

  for (const row_axis of row_axes) {
    if (data_views_constants.row_axis_params.includes(row_axis)) {
      // Grain axis stays 'year' in the row-axis vocabulary; alias the
      // renamed physical column back so this CTE's own output keeps the
      // 'year' name for downstream consumers.
      const physical_row_axis = row_axis === 'year' ? 'season_year' : row_axis
      const row_axis_statement =
        row_axis === 'year'
          ? `nfl_plays.${physical_row_axis} as year`
          : `nfl_plays.${physical_row_axis}`
      with_query.select(row_axis_statement)
      with_query.groupBy(`nfl_plays.${physical_row_axis}`)
    }
  }

  const unique_select_strings = new Set(select_strings)

  for (const select_string of unique_select_strings) {
    with_query.select(db.raw(select_string))
  }

  // Handle career_year and career_game separately. Both are properties of the
  // SUBJECT, so each resolves against whatever names the subject in this scan:
  // the role columns, or the already-joined cohort members row.
  if (params.career_year) {
    with_query.join('player_seasonlogs', function () {
      this.on(function () {
        if (is_cohort) {
          this.on(subject_id, '=', 'player_seasonlogs.pid')
        } else {
          for (const pid_column of role_columns) {
            this.orOn(`nfl_plays.${pid_column}`, '=', 'player_seasonlogs.pid')
          }
        }
      })
        .andOn('nfl_plays.season_year', '=', 'player_seasonlogs.season_year')
        .andOn('nfl_plays.season_type', '=', 'player_seasonlogs.season_type')
    })
    with_query.whereBetween(
      'player_seasonlogs.career_year',
      normalize_career_year_range(params.career_year)
    )
  }

  if (params.career_game) {
    // The cohort expansion already joins the gamelogs the career counter lives
    // on, so a second join to the same table would both duplicate rows and be
    // ambiguous.
    if (is_cohort) {
      with_query.whereBetween(
        `${cohort_expansion.alias}.career_game`,
        normalize_career_year_range(params.career_game)
      )
    } else {
      with_query.join('player_gamelogs', function () {
        this.on(function () {
          for (const pid_column of role_columns) {
            this.orOn(`nfl_plays.${pid_column}`, '=', 'player_gamelogs.pid')
          }
        }).andOn('nfl_plays.esbid', '=', 'player_gamelogs.esbid')
      })
      with_query.whereBetween(
        'player_gamelogs.career_game',
        normalize_career_year_range(params.career_game)
      )
    }
  }

  // Remove career_year and career_game from params before applying other filters
  const filtered_params = default_params
  delete filtered_params.career_year
  delete filtered_params.career_game

  apply_play_by_play_column_params_to_query({
    query: with_query,
    params: filtered_params,
    query_context: data_view_options.query_context
  })

  // Add groupBy clause before having
  with_query.groupBy(is_cohort ? subject_id : db.raw(subject_id))

  // where_clauses to filter stats/metrics. DEDUPED: a view carrying the same
  // column twice (two instances of one share, say) hands this builder the same
  // having clause once per instance, and emitting it twice is a redundant
  // predicate that moves the SQL without changing the answer.
  for (const having_clause of new Set(having_clauses)) {
    with_query.havingRaw(having_clause)
  }

  // Skip when scope has been emitted: apply_play_by_play_column_params_to_query
  // (with query_context) already pushes nfl_plays.season_year via apply_scope_to_query,
  // and the legacy nfl_week_id branch pushes year on its own when nfl_week_id is
  // set. Only emit here for callers without view scope and without nfl_week_id.
  const view_scope_emitted =
    data_view_options.query_context &&
    data_view_options.query_context.nfl_week_ids &&
    data_view_options.query_context.nfl_week_ids.length
  const effective_years = get_effective_years({ params, data_view_options })
  if (!params.nfl_week_id && !view_scope_emitted && effective_years.length) {
    with_query.whereIn('nfl_plays.season_year', effective_years)
  }

  // The cohort members table carries its own season column and is reached by a
  // join the plays-side predicates never touch, so it needs restricting on its
  // own or the expansion pairs a play with every season of that team's roster.
  if (is_cohort && effective_years.length) {
    with_query.whereIn(`${cohort_expansion.alias}.season_year`, effective_years)
  }

  // MATERIALIZED required: predicates are pushed at construction time; planner
  // predicate push-into-CTE is not needed and would mask the partition-pruning
  // behavior we rely on, and would let the planner inline the CTE into a
  // nested-loop that re-executes it per outer row.
  query.withMaterialized(with_table_name, with_query)
}
