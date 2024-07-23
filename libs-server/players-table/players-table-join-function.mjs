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
    join_week = false
  } = join_arguments

  const join_func = get_join_func(join_type)
  const year_offset = Array.isArray(params.year_offset)
    ? params.year_offset[0]
    : params.year_offset || 0
  const year = params.year || constants.season.year
  const week = params.week || 0

  query[join_func](join_table_clause || table_name, function () {
    this.on(`${table_name}.pid`, '=', 'player.pid')

    if (splits.length && year_split_join_clause) {
      if (splits.includes('year')) {
        if (year_offset !== 0) {
          this.andOn(
            db.raw(`${table_name}.year = ${year_split_join_clause} + ?`, [
              year_offset
            ])
          )
        } else {
          this.andOn(db.raw(`${table_name}.year = ${year_split_join_clause}`))
        }
      } else if (year) {
        this.andOn(
          `${table_name}.year`,
          '=',
          db.raw('?', [Array.isArray(year) ? year[0] : year])
        )
      }

      if (splits.includes('week') && week_split_join_clause) {
        this.andOn(db.raw(`${table_name}.week = ${week_split_join_clause}`))
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
      if (join_year && params.year) {
        if (splits.includes('year')) {
          const year_array = Array.isArray(year) ? year : [year]
          this.andOn(
            db.raw(
              `${table_name}.year IN (${year_array.map((y) => y + year_offset).join(',')})`
            )
          )
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
        this.andOn(
          db.raw(
            `${table_name}.year IN (${year_array.map((y) => y + year_offset).join(',')})`
          )
        )
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
