// @ts-check
import resolve_nfl_week_id_from_year_param from '#libs-server/data-views/resolve-nfl-week-id-from-year-param.mjs'

/**
 * @param {object} args
 * @param {Record<string, any>} args.params - raw query params off the request,
 *   so the values are whatever the wire carried: a string, an array of strings,
 *   or absent. The narrowing below is what turns that into a seas_type list.
 */
export default ({ params }) => {
  const season_type = Array.isArray(params.seas_type)
    ? params.seas_type
    : params.seas_type
      ? [params.seas_type]
      : ['REG']

  const nfl_week_id = resolve_nfl_week_id_from_year_param({
    ...params,
    seas_type: season_type
  })

  return {
    ...params,
    seas_type: season_type,
    ...(nfl_week_id.length && !params.nfl_week_id ? { nfl_week_id } : {})
  }
}
