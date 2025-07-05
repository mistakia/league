import db from '#db'
import { constants } from '#libs-shared'
import get_join_func from '#libs-server/get-join-func.mjs'
import get_table_hash from '#libs-server/data-views/get-table-hash.mjs'
import {
  create_date_based_cache_info,
  CACHE_TTL
} from '#libs-server/data-views/cache-info-utils.mjs'

// TODO career_year

const get_default_params = ({ params = {} } = {}) => {
  const date = params.date || null
  const year = Array.isArray(params.year)
    ? params.year[0]
    : params.year || constants.season.year

  const year_offset_single = Array.isArray(params.year_offset)
    ? params.year_offset[0]
    : params.year_offset || 0
  return { date, year, year_offset_single }
}

const get_cache_info_for_keeptradecut = create_date_based_cache_info({
  get_date_params: ({ params = {} } = {}) => get_default_params({ params }),
  calculate_ttl: ({ date, year }) => {
    if (date) {
      return CACHE_TTL.THIRTY_DAYS
    }
    return year === constants.season.year
      ? CACHE_TTL.SIX_HOURS
      : CACHE_TTL.THIRTY_DAYS
  }
})

const generate_table_alias = ({ type, params = {} } = {}) => {
  const { date, year, year_offset_single } = get_default_params({ params })
  const key = `keeptradecut_${type}_data_${date || ''}_year_${year || ''}_year_offset_${year_offset_single || ''}`
  return get_table_hash(key)
}

const keeptradecut_join = ({
  type,
  query,
  table_name,
  join_type = 'LEFT',
  splits = [],
  params = {},
  data_view_options = {}
}) => {
  // using an inner join for week splits because its much faster, not sure why
  const join_func = get_join_func(splits.includes('week') ? 'INNER' : join_type)
  const { year_offset_single } = get_default_params({ params })

  if (splits.includes('year') && !data_view_options.opening_days_joined) {
    query.leftJoin(
      'opening_days',
      'opening_days.year',
      data_view_options.year_reference
    )
    data_view_options.opening_days_joined = true
  }

  if (
    splits.includes('week') &&
    !data_view_options.nfl_year_week_timestamp_joined
  ) {
    if (splits.includes('year')) {
      query.leftJoin('nfl_year_week_timestamp', function () {
        this.on('nfl_year_week_timestamp.year', '=', 'player_years_weeks.year')
        this.on('nfl_year_week_timestamp.week', '=', 'player_years_weeks.week')
      })
    } else {
      query.leftJoin('nfl_year_week_timestamp', function () {
        this.on(db.raw('true'))
      })
    }
    data_view_options.nfl_year_week_timestamp_joined = true
  }

  const join_conditions = function () {
    this.on(`${table_name}.pid`, '=', data_view_options.pid_reference)
    this.andOn(`${table_name}.qb`, '=', db.raw('?', [params.qb || 2]))
    this.andOn(`${table_name}.type`, '=', db.raw('?', [type]))

    if (splits.includes('week')) {
      // TODO handle year_offset_single and week_offset_single
      this.andOn(
        `${table_name}.d`,
        '=',
        'nfl_year_week_timestamp.week_timestamp'
      )
    } else if (splits.includes('year')) {
      this.andOn(
        `${table_name}.d`,
        '=',
        db.raw(
          `EXTRACT(EPOCH FROM (date_trunc('day', opening_days.opening_day) + interval '${year_offset_single} year'))::integer`
        )
      )

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
        this.andOn(db.raw(`opening_days.year IN (${year_array.join(', ')})`))
      }
    } else if (params.date) {
      this.andOn(
        `${table_name}.d`,
        '=',
        db.raw(
          `EXTRACT(EPOCH FROM (to_timestamp(?, 'YYYY-MM-DD') + interval '${year_offset_single} year') AT TIME ZONE 'UTC')::integer`,
          [params.date]
        )
      )
    } else {
      this.andOn(`${table_name}.d`, '=', function () {
        this.select(db.raw('MAX(d)'))
          .from('keeptradecut_rankings')
          .where('pid', db.raw(data_view_options.pid_reference))
          .where('qb', db.raw('?', [params.qb || 2]))
          .where('type', db.raw('?', [type]))
      })
    }
  }

  query[join_func]('keeptradecut_rankings as ' + table_name, join_conditions)
}

const create_keeptradecut_definition = (type) => ({
  table_alias: (opts) => generate_table_alias({ type, ...opts }),
  select_as: () => `player_keeptradecut_${type}`,
  column_name: 'v',
  main_where: ({ table_name }) => `${table_name}.v`,
  join: ({ ...args }) =>
    keeptradecut_join({
      type: constants.KEEPTRADECUT[type.toUpperCase()],
      ...args
    }),
  year_select: ({ splits, table_name, column_params = {} }) => {
    const { year_offset_single } = get_default_params({ params: column_params })

    if (splits.includes('week')) {
      return `nfl_year_week_timestamp.year`
    }
    return year_offset_single
      ? `EXTRACT(YEAR FROM TO_TIMESTAMP(${table_name}.d)) - ${year_offset_single}`
      : `EXTRACT(YEAR FROM TO_TIMESTAMP(${table_name}.d))`
  },
  week_select: () => `nfl_year_week_timestamp.week`,
  supported_splits: ['year', 'week'],
  get_cache_info: get_cache_info_for_keeptradecut
})

export default {
  player_keeptradecut_value: create_keeptradecut_definition('value'),
  player_keeptradecut_overall_rank:
    create_keeptradecut_definition('overall_rank'),
  player_keeptradecut_position_rank:
    create_keeptradecut_definition('position_rank')
}
