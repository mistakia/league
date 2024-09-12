import COLUMN_GROUPS from './column-groups'
import * as table_constants from 'react-table/src/constants.mjs'
import { constants, common_column_params } from '#libs-shared'

const { single_year } = common_column_params

const player_contract_field = (props) => ({
  ...props,
  column_groups: [COLUMN_GROUPS.PLAYER_CONTRACT],
  size: 70,
  data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
  column_params: {
    contract_year: {
      ...single_year,
      values: [
        constants.year,
        'Total',
        ...[...Array(constants.year - 1983).keys()].map(
          (i) => constants.year - 1 - i
        )
      ],
      default_value: constants.year
      // TODO enable multi-year
      // enable_multi_on_split: ['year']
    }

    // TODO enable career_year param
  }
  // TODO enable splits
})

export default {
  player_contract_base_salary: player_contract_field({
    column_title: 'Contract Base Salary (Year)',
    header_label: 'Base',
    player_value_path: 'base_salary'
  }),
  player_contract_prorated_bonus: player_contract_field({
    column_title: 'Contract Prorated Bonus (Year)',
    header_label: 'Prorated Bonus',
    player_value_path: 'prorated_bonus'
  }),
  player_contract_roster_bonus: player_contract_field({
    column_title: 'Contract Roster Bonus (Year)',
    header_label: 'Roster Bonus',
    player_value_path: 'roster_bonus'
  }),
  player_contract_guaranteed_salary: player_contract_field({
    column_title: 'Contract Guaranteed Salary (Year)',
    header_label: 'Guaranteed',
    player_value_path: 'guaranteed_salary'
  }),
  player_contract_cap_number: player_contract_field({
    column_title: 'Contract Cap Number (Year)',
    header_label: 'Cap Number',
    player_value_path: 'cap_number'
  }),
  player_contract_cap_percent: player_contract_field({
    column_title: 'Contract Cap Percent (Year)',
    header_label: 'Cap %',
    player_value_path: 'cap_percent'
  }),
  player_contract_cash_paid: player_contract_field({
    column_title: 'Contract Cash Paid (Year)',
    header_label: 'Cash Paid',
    player_value_path: 'cash_paid'
  }),
  player_contract_workout_bonus: player_contract_field({
    column_title: 'Contract Workout Bonus (Year)',
    header_label: 'Workout Bonus',
    player_value_path: 'workout_bonus'
  }),
  player_contract_other_bonus: player_contract_field({
    column_title: 'Contract Other Bonus (Year)',
    header_label: 'Other Bonus',
    player_value_path: 'other_bonus'
  }),
  player_contract_per_game_roster_bonus: player_contract_field({
    column_title: 'Contract Per Game Roster Bonus (Year)',
    header_label: 'Per Game Bonus',
    player_value_path: 'per_game_roster_bonus'
  }),
  player_contract_option_bonus: player_contract_field({
    column_title: 'Contract Option Bonus (Year)',
    header_label: 'Option Bonus',
    player_value_path: 'option_bonus'
  })
}
