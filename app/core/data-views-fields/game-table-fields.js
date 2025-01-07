import React from 'react'
import PropTypes from 'prop-types'
import * as table_constants from 'react-table/src/constants.mjs'

import COLUMN_GROUPS from './column-groups'
import { common_column_params } from '@libs-shared'
import GameOpponent from '@components/game-opponent'

const { single_year, single_week, single_seas_type } = common_column_params

const OpponentComponent = ({ row, column_index }) => {
  const is_home = row.original[`game_is_home_${column_index}`]
  const opponent = row.original[`game_opponent_${column_index}`]

  return <GameOpponent {...{ is_home, opponent }} />
}

OpponentComponent.propTypes = {
  row: PropTypes.object,
  column_index: PropTypes.number
}

const create_game_field = (props) => ({
  ...props,
  column_groups: [COLUMN_GROUPS.NFL_GAME],
  size: 100,
  data_type: table_constants.TABLE_DATA_TYPES.TEXT,
  column_params: {
    year: single_year,
    week: single_week,
    seas_type: single_seas_type
  },
  splits: ['year', 'week', 'seas_type']
})

export default {
  game_opponent: create_game_field({
    column_title: 'Game Opponent',
    header_label: 'Opp',
    component: React.memo(OpponentComponent),
    data_type: table_constants.TABLE_DATA_TYPES.TEXT,
    size: 80
  })
}
