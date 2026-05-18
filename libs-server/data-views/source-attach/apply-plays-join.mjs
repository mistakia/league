import db from '#db'

// Shared source.attach helper for column-defs whose `with` callback builds a
// pid+year(+week) CTE off `nfl_plays`. Accepts an optional `extra_conditions`
// callback for per-column predicates like `pid_column`. Pid equality is
// always emitted; year/week predicates are emitted only when the bucket's
// splits projected those columns onto the CTE. Year/week references prefer
// from-table-aware data_view_options so from-table-optimization scenarios
// resolve against the FROM-table aliases instead of the unjoined player_years
// identity CTE.
export const apply_plays_join = ({
  query_context,
  params,
  table_alias,
  join_type,
  splits = [],
  extra_conditions
}) => {
  const dv = query_context.data_view_options || {}
  const { players_query } = query_context
  const pid_reference = dv.pid_reference ?? query_context.pid_reference
  const year_reference = dv.year_reference ?? query_context.year_reference
  const week_reference = dv.week_reference ?? query_context.week_reference
  const year_offset_param = params.year_offset
  const year_offset_range = Array.isArray(year_offset_param)
    ? year_offset_param
    : [year_offset_param || 0, year_offset_param || 0]
  const min_year_offset = Math.min(...year_offset_range)
  const max_year_offset = Math.max(...year_offset_range)
  const join_method = join_type === 'INNER' ? 'innerJoin' : 'leftJoin'
  const join_year = splits.includes('year')
  const join_week = splits.includes('week')

  players_query[join_method](table_alias, function () {
    this.on(`${table_alias}.pid`, '=', pid_reference)

    if (join_year && year_reference) {
      if (min_year_offset !== 0 || max_year_offset !== 0) {
        if (min_year_offset === max_year_offset) {
          this.andOn(
            db.raw(`${table_alias}.year = ${year_reference} + ?`, [
              min_year_offset
            ])
          )
        } else {
          this.andOn(
            db.raw(
              `${table_alias}.year BETWEEN ${year_reference} + ? AND ${year_reference} + ?`,
              [min_year_offset, max_year_offset]
            )
          )
        }
      } else {
        const single_year_param_set =
          params.year &&
          (Array.isArray(params.year) ? params.year.length === 1 : true)
        if (single_year_param_set) {
          const specific_year = Array.isArray(params.year)
            ? params.year[0]
            : params.year
          this.andOn(`${table_alias}.year`, '=', db.raw('?', [specific_year]))
        } else {
          this.andOn(db.raw(`${table_alias}.year = ${year_reference}`))
          if (params.year) {
            const year_array = Array.isArray(params.year)
              ? params.year
              : [params.year]
            if (year_array.length > 0) {
              this.andOnIn(`${table_alias}.year`, year_array)
            }
          }
        }
      }
    }

    if (join_week && week_reference) {
      this.andOn(db.raw(`${table_alias}.week = ${week_reference}`))
    }

    if (typeof extra_conditions === 'function') {
      extra_conditions.call(this, { table_alias, params, query_context })
    }
  })
}
