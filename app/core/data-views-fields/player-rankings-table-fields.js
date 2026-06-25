import COLUMN_GROUPS from './column-groups'
import * as table_constants from 'react-table/src/constants.mjs'
import { common_column_params } from '#libs-shared'
import { current_season } from '@constants'

const { single_year } = common_column_params

const ranking_source_id = {
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
}

const ranking_type = {
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

const create_player_season_rankings_field = (props) => ({
  ...props,
  column_groups: [COLUMN_GROUPS.RANKINGS],
  size: 70,
  data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
  column_params: {
    year: {
      ...single_year,
      default_value: current_season.year
    },
    ranking_source_id,
    ranking_type
  },
  row_axes: ['year']
})

export default {
  player_season_average_ranking: create_player_season_rankings_field({
    column_title: 'Season Average Ranking / Draft Position (ADP)',
    header_label: 'Avg',
    player_value_path: 'average_rank',
    reverse_percentiles: true
  }),
  player_season_overall_ranking: create_player_season_rankings_field({
    column_title: 'Season Overall Ranking',
    header_label: 'Overall Rank',
    player_value_path: 'overall_rank',
    reverse_percentiles: true
  }),
  player_season_position_ranking: create_player_season_rankings_field({
    column_title: 'Season Position Ranking',
    header_label: 'Pos Rank',
    player_value_path: 'position_rank',
    reverse_percentiles: true
  }),
  player_season_min_ranking: create_player_season_rankings_field({
    column_title: 'Season Minimum Ranking',
    header_label: 'Min Rank',
    player_value_path: 'min_rank',
    reverse_percentiles: true
  }),
  player_season_max_ranking: create_player_season_rankings_field({
    column_title: 'Season Maximum Ranking',
    header_label: 'Max Rank',
    player_value_path: 'max_rank',
    reverse_percentiles: true
  }),
  player_season_ranking_standard_deviation: create_player_season_rankings_field(
    {
      column_title: 'Season Ranking Standard Deviation',
      header_label: 'Rank StdDev',
      player_value_path: 'rank_stddev',
      reverse_percentiles: true
    }
  )
}
