import { constants } from '#libs-shared'
import db from '#db'
import get_join_func from '#libs-server/get-join-func.mjs'

export default function players_table_join_function(join_arguments) {
  const {
    query,
    table_name,
    join_table_clause,
    join_type = 'LEFT',
    splits = [],
    year_split_join_clause = null,
    week_split_join_clause = null,
    params = {},
    additional_conditions = null,
    join_year = false,
    join_year_on_year_split = false,
    join_week = false,
    cast_join_week_to_string = false,
    default_year = constants.season.year
  } = join_arguments

  // TODO join_type should be left in some cases where year_offset range is used without a with_where

  const join_func = get_join_func(join_type)
  const year_offset_param = params.year_offset
  const year_offset_range = Array.isArray(year_offset_param)
    ? year_offset_param
    : [year_offset_param || 0, year_offset_param || 0]
  const min_year_offset = Math.min(...year_offset_range)
  const max_year_offset = Math.max(...year_offset_range)
  const year = params.year || default_year
  const week = params.week || 0

  query[join_func](join_table_clause || table_name, function () {
    this.on(`${table_name}.pid`, '=', 'player.pid')

    if (splits.length && year_split_join_clause) {
      if (splits.includes('year')) {
        if (min_year_offset !== 0 || max_year_offset !== 0) {
          if (min_year_offset === max_year_offset) {
            this.andOn(
              db.raw(`${table_name}.year = ${year_split_join_clause} + ?`, [
                min_year_offset
              ])
            )
          } else {
            this.andOn(
              db.raw(
                `${table_name}.year BETWEEN ${year_split_join_clause} + ? AND ${year_split_join_clause} + ?`,
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
            this.andOn(`${table_name}.year`, '=', db.raw('?', [specific_year]))
          } else {
            this.andOn(db.raw(`${table_name}.year = ${year_split_join_clause}`))

            if (params.year) {
              this.andOn(
                db.raw(
                  `${table_name}.year IN (${Array.isArray(year) ? year.join(',') : year})`
                )
              )
            }
          }
        }
      } else if (year) {
        this.andOn(
          `${table_name}.year`,
          '=',
          db.raw('?', [Array.isArray(year) ? year[0] : year])
        )
      }

      if (splits.includes('week') && week_split_join_clause) {
        const week_clause = cast_join_week_to_string
          ? `CAST(${week_split_join_clause} AS VARCHAR)`
          : week_split_join_clause
        this.andOn(db.raw(`${table_name}.week = ${week_clause}`))
      }

      if (join_week) {
        if (splits.includes('week')) {
          // if week is specified, use it otherwise do not limit weeks
          if (params.week) {
            const week_array = Array.isArray(week)
              ? week.map(String)
              : [String(week)]
            this.andOn(
              db.raw(`${table_name}.week IN (${week_array.join(',')})`)
            )
          }
        } else {
          this.andOn(
            `${table_name}.week`,
            '=',
            db.raw('?', [String(Array.isArray(week) ? week[0] : week)])
          )
        }
      }
    } else {
      // TODO check if params.year creates any edge case bugs when joining sesaonlogs
      if (join_year && (params.year || !splits.includes('year'))) {
        if (splits.includes('year')) {
          const year_array = Array.isArray(year) ? year : [year]
          if (min_year_offset === max_year_offset) {
            this.andOn(
              db.raw(
                `${table_name}.year IN (${year_array.map((y) => y + min_year_offset).join(',')})`
              )
            )
          } else {
            this.andOn(
              db.raw(`${table_name}.year BETWEEN ? AND ?`, [
                Math.min(...year_array) + min_year_offset,
                Math.max(...year_array) + max_year_offset
              ])
            )
          }
        } else {
          this.andOn(
            `${table_name}.year`,
            '=',
            db.raw('?', [Array.isArray(year) ? year[0] : year])
          )
        }
      }

      // TODO somewhat hacky way to deal with joins for player stats from plays
      if (join_year_on_year_split && splits.includes('year') && params.year) {
        const year_array = Array.isArray(year) ? year : [year]
        if (min_year_offset === max_year_offset) {
          this.andOn(
            db.raw(
              `${table_name}.year IN (${year_array.map((y) => y + min_year_offset).join(',')})`
            )
          )
        } else {
          this.andOn(
            db.raw(`${table_name}.year BETWEEN ? AND ?`, [
              Math.min(...year_array) + min_year_offset,
              Math.max(...year_array) + max_year_offset
            ])
          )
        }
      }

      if (join_week) {
        if (splits.includes('week')) {
          const week_array = Array.isArray(week)
            ? week.map(String)
            : [String(week)]
          this.andOn(db.raw(`${table_name}.week IN (${week_array.join(',')})`))
        } else {
          this.andOn(
            `${table_name}.week`,
            '=',
            db.raw('?', [String(Array.isArray(week) ? week[0] : week)])
          )
        }
      }
    }

    // Add any additional conditions specific to the table
    if (additional_conditions) {
      additional_conditions.call(this, join_arguments)
    }
  })
}
