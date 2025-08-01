import COLUMN_GROUPS from './column-groups'
import * as table_constants from 'react-table/src/constants.mjs'
import { constants, common_column_params } from '#libs-shared'

const { single_year, single_week } = common_column_params

const create_player_rankings_field = (props) => ({
  ...props,
  column_groups: [COLUMN_GROUPS.RANKINGS],
  size: 70,
  data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
  column_params: {
    year: {
      ...single_year,
      default_value: constants.year
    },
    week: {
      ...single_week,
      default_value: constants.season.week,
      values: [
        {
          value: 0,
          label: 'Season'
        },
        ...single_week.values
      ]
    },
    ranking_source_id: {
      values: [
        'FANTASYPROS',
        'SLEEPER',
        'ESPN',
        'RTS',
        'MFL',
        'YAHOO',
        'NFL',
        'CBS',
        'UNDERDOG'
      ],
      data_type: table_constants.TABLE_DATA_TYPES.SELECT,
      single: true,
      default_value: 'FANTASYPROS',
      label: 'Source'
    },
    ranking_type: {
      values: [
        'STANDARD_REDRAFT',
        'PPR_REDRAFT',
        'STANDARD_SUPERFLEX_REDRAFT',
        'PPR_SUPERFLEX_REDRAFT',
        'STANDARD_DYNASTY',
        'PPR_DYNASTY',
        'STANDARD_SUPERFLEX_DYNASTY',
        'PPR_SUPERFLEX_DYNASTY',
        'STANDARD_ROOKIE',
        'PPR_ROOKIE',
        'STANDARD_SUPERFLEX_ROOKIE',
        'PPR_SUPERFLEX_ROOKIE',
        'HALF_PPR_REDRAFT',
        'HALF_PPR_SUPERFLEX_REDRAFT',
        'HALF_PPR_DYNASTY',
        'HALF_PPR_SUPERFLEX_DYNASTY',
        'HALF_PPR_ROOKIE',
        'HALF_PPR_SUPERFLEX_ROOKIE'
      ],
      data_type: table_constants.TABLE_DATA_TYPES.SELECT,
      single: true,
      default_value: 'PPR_REDRAFT',
      label: 'Ranking Type'
    }
  },
  splits: ['year', 'week']
})

export default {
  player_average_ranking: create_player_rankings_field({
    column_title: 'Average Ranking / Draft Position (ADP)',
    header_label: 'Avg',
    player_value_path: 'average_rank',
    reverse_percentiles: true
  }),
  player_overall_ranking: create_player_rankings_field({
    column_title: 'Overall Ranking',
    header_label: 'Overall Rank',
    player_value_path: 'overall_rank',
    reverse_percentiles: true
  }),
  player_position_ranking: create_player_rankings_field({
    column_title: 'Position Ranking',
    header_label: 'Pos Rank',
    player_value_path: 'position_rank',
    reverse_percentiles: true
  }),
  player_min_ranking: create_player_rankings_field({
    column_title: 'Minimum Ranking',
    header_label: 'Min Rank',
    player_value_path: 'min_rank',
    reverse_percentiles: true
  }),
  player_max_ranking: create_player_rankings_field({
    column_title: 'Maximum Ranking',
    header_label: 'Max Rank',
    player_value_path: 'max_rank',
    reverse_percentiles: true
  }),
  player_ranking_standard_deviation: create_player_rankings_field({
    column_title: 'Ranking Standard Deviation',
    header_label: 'Rank StdDev',
    player_value_path: 'rank_stddev',
    reverse_percentiles: true
  })
}
