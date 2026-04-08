import resolve_nfl_week_id_from_year_param from '#libs-server/data-views/resolve-nfl-week-id-from-year-param.mjs'

export default ({ params }) => {
  const seas_type = Array.isArray(params.seas_type)
    ? params.seas_type
    : params.seas_type
      ? [params.seas_type]
      : ['REG']

  const nfl_week_id = resolve_nfl_week_id_from_year_param(params)

  return {
    ...params,
    seas_type,
    ...(nfl_week_id.length && !params.nfl_week_id ? { nfl_week_id } : {})
  }
}
