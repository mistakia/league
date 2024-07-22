import db from '#db'
import { constants } from '#libs-shared'
import get_join_func from '#libs-server/get-join-func.mjs'
import get_table_hash from '#libs-server/get-table-hash.mjs'

const generate_table_alias = ({ type, params = {} } = {}) => {
  const { date, year } = params
  const key = `keeptradecut_${type}_data_${date || ''}_year_${year || ''}`
  return get_table_hash(key)
}

const keeptradecut_join = ({
  type,
  query,
  table_name,
  join_type = 'LEFT',
  splits = [],
  year_split_join_clause = null,
  params = {}
}) => {
  const join_func = get_join_func(join_type)
  let year_offset = params.year_offset || 0
  if (Array.isArray(year_offset)) {
    year_offset = year_offset[0]
  }

  const join_conditions = function () {
    this.on(`${table_name}.pid`, '=', 'player.pid')
    this.andOn(`${table_name}.qb`, '=', db.raw('?', [params.qb || 2]))
    this.andOn(`${table_name}.type`, '=', db.raw('?', [type]))

    if (splits.includes('year')) {
      if (params.year) {
        const year_array = Array.isArray(params.year)
          ? params.year
          : [params.year]
        this.andOn(
          db.raw(
            `${table_name}.d IN (${year_array
              .map(
                (year) =>
                  `EXTRACT(EPOCH FROM to_timestamp('${year + year_offset}-09-01', 'YYYY-MM-DD') AT TIME ZONE 'UTC')::integer`
              )
              .join(', ')})`
          )
        )
      }
    } else if (params.date) {
      this.andOn(
        `${table_name}.d`,
        '=',
        db.raw(
          `EXTRACT(EPOCH FROM to_timestamp(?, 'YYYY-MM-DD') AT TIME ZONE 'UTC')::integer`,
          [params.date]
        )
      )
    } else {
      this.andOn(`${table_name}.d`, '=', function () {
        this.select(db.raw('MAX(d)'))
          .from('keeptradecut_rankings')
          .where('pid', db.raw('player.pid'))
          .where('qb', db.raw('?', [params.qb || 2]))
          .where('type', db.raw('?', [type]))
      })
    }

    if (splits.includes('year') && year_split_join_clause) {
      splits.forEach((split) => {
        if (split === 'year') {
          if (year_offset !== 0) {
            this.andOn(
              db.raw(
                `DATE_TRUNC('year', to_timestamp(${table_name}.d)::timestamp) + interval '${year_offset} year'`
              ),
              '=',
              db.raw(`${year_split_join_clause}`)
            )
          } else {
            this.andOn(
              db.raw(
                `EXTRACT(YEAR FROM to_timestamp(${table_name}.d)::timestamp)`
              ),
              '=',
              db.raw(`${year_split_join_clause}`)
            )
          }
        }
      })
    }
  }

  query[join_func]('keeptradecut_rankings as ' + table_name, join_conditions)
}

const create_keeptradecut_definition = (type) => ({
  table_alias: (opts) => generate_table_alias({ type, ...opts }),
  select_as: () => `player_keeptradecut_${type}`,
  column_name: 'v',
  where_column: ({ table_name }) => `${table_name}.v`,
  join: ({ ...args }) =>
    keeptradecut_join({
      type: constants.KEEPTRADECUT[type.toUpperCase()],
      ...args
    }),
  year_select: (table_name) =>
    `EXTRACT(YEAR FROM TO_TIMESTAMP(${table_name}.d))`,
  supported_splits: ['year']
})

export default {
  player_keeptradecut_value: create_keeptradecut_definition('value'),
  player_keeptradecut_overall_rank:
    create_keeptradecut_definition('overall_rank'),
  player_keeptradecut_position_rank:
    create_keeptradecut_definition('position_rank')
}
