import db from '#db'

import { current_season } from '#constants'
import get_table_hash from '#libs-server/data-views/get-table-hash.mjs'
import get_join_func from '#libs-server/get-join-func.mjs'
import { create_static_cache_info } from '#libs-server/data-views/cache-info-utils.mjs'

// TODO career_year
// refactor to use with/cte table to handle career_year

const get_cache_info = create_static_cache_info()

const get_contract_year = (value = current_season.year) => {
  const year = Array.isArray(value) ? value[0] : value
  if (typeof year === 'string' && year.toLowerCase() === 'total') {
    return 'Total'
  }
  return year
}

const player_contract_table_alias = ({ params = {} } = {}) => {
  const year = get_contract_year(params.contract_year)

  let career_year = params.career_year || []
  if (!Array.isArray(career_year)) {
    career_year = [career_year]
  }

  const key = `player_contracts_${year}_${career_year.join('_')}`
  return get_table_hash(key)
}

const player_contract_join = ({
  query,
  table_name,
  join_type = 'LEFT',
  params = {},
  data_view_options = {}
} = {}) => {
  const join_func = get_join_func(join_type)
  const year = get_contract_year(params.contract_year)

  const join_conditions = function () {
    this.on(`${table_name}.pid`, '=', data_view_options.pid_reference)
    this.andOn(db.raw(`${table_name}.year = '${year}'`))
  }

  query[join_func](`player_contracts as ${table_name}`, join_conditions)
}

const create_player_contract_field = (field) => ({
  column_name: field,
  table_name: 'player_contracts',
  table_alias: player_contract_table_alias,
  join: player_contract_join,
  get_cache_info
})

export default {
  player_contract_base_salary: create_player_contract_field('base_salary'),
  player_contract_prorated_bonus:
    create_player_contract_field('prorated_bonus'),
  player_contract_roster_bonus: create_player_contract_field('roster_bonus'),
  player_contract_guaranteed_salary:
    create_player_contract_field('guaranteed_salary'),
  player_contract_cap_number: create_player_contract_field('cap_number'),
  player_contract_cap_percent: create_player_contract_field('cap_percent'),
  player_contract_cash_paid: create_player_contract_field('cash_paid'),
  player_contract_workout_bonus: create_player_contract_field('workout_bonus'),
  player_contract_other_bonus: create_player_contract_field('other_bonus'),
  player_contract_per_game_roster_bonus: create_player_contract_field(
    'per_game_roster_bonus'
  ),
  player_contract_option_bonus: create_player_contract_field('option_bonus')
}
