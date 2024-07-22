import db from '#db'
import get_join_func from '#libs-server/get-join-func.mjs'

const get_valid_year = (year) => {
  const parsed_year = Number(year)
  return parsed_year >= 2017 && parsed_year <= 2023 ? parsed_year : 2023
}

const create_espn_score_columns = (column_name) => ({
  table_name: 'player_seasonlogs',
  column_name,
  join: ({
    query,
    params,
    join_type = 'LEFT',
    splits = [],
    year_split_join_clause = null
  } = {}) => {
    const join_func = get_join_func(join_type)
    const join_conditions = function () {
      this.on('player_seasonlogs.pid', '=', 'player.pid')
      this.andOn('player_seasonlogs.seas_type', '=', db.raw('?', ['REG']))

      if (splits.includes('year') && year_split_join_clause) {
        splits.forEach((split) => {
          this.andOn(
            'player_seasonlogs.year',
            '=',
            db.raw(`${year_split_join_clause}`)
          )
        })
      } else if (splits.includes('year')) {
        if (params.year) {
          const year_array = Array.isArray(params.year)
            ? params.year
            : [params.year]
          this.andOn(
            db.raw(`player_seasonlogs.year IN (${year_array.join(',')})`)
          )
        }
      } else {
        const year = get_valid_year(params.year)
        this.andOn('player_seasonlogs.year', '=', year)
      }

      if (params.career_year) {
        this.andOn(
          'player_seasonlogs.career_year',
          '>=',
          Math.min(params.career_year[0], params.career_year[1])
        ).andOn(
          'player_seasonlogs.career_year',
          '<=',
          Math.max(params.career_year[0], params.career_year[1])
        )
      }
    }

    query[join_func]('player_seasonlogs', join_conditions)
  },
  supported_splits: ['year']
})

export default {
  player_espn_open_score: create_espn_score_columns('espn_open_score'),
  player_espn_catch_score: create_espn_score_columns('espn_catch_score'),
  player_espn_overall_score: create_espn_score_columns('espn_overall_score'),
  player_espn_yac_score: create_espn_score_columns('espn_yac_score')
}
