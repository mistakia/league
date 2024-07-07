import COLUMN_GROUPS from './column-groups'
import * as table_constants from 'react-table/src/constants.mjs'
import { constants, stat_in_year_week } from '@libs-shared'

const projection_years = [2020, 2021, 2022, 2023, 2024]

export default function ({ week }) {
  const create_field = ({
    base_name,
    title,
    groups,
    label,
    stat,
    options = {}
  }) => ({
    [`player_week_projected_${base_name}`]: create_projection_field({
      title,
      period: 'Week',
      groups,
      label,
      stat,
      options: { week, ...options }
    }),
    [`player_season_projected_${base_name}`]: create_projection_field({
      title,
      period: 'Season',
      groups,
      label,
      stat,
      options
    }),
    [`player_rest_of_season_projected_${base_name}`]: create_projection_field({
      title,
      period: 'Rest-Of-Season',
      groups,
      label,
      stat,
      options: { week: 'ros', ...options }
    })
  })

  const create_projection_field = ({
    title,
    period,
    groups,
    label,
    stat,
    options = {}
  }) => ({
    column_title: `Projected ${title} (${period})`,
    column_groups: [
      COLUMN_GROUPS.PROJECTION,
      COLUMN_GROUPS[`${period.toUpperCase().replaceAll('-', '_')}_PROJECTION`],
      ...groups
    ],
    header_label: label,
    player_value_path: stat_in_year_week(stat)(
      options.week ? { params: { week: options.week } } : {}
    ),
    ...(options.fixed && { fixed: options.fixed }),
    size: 70,
    data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
    column_params:
      period === 'Season'
        ? {
            year: {
              values: projection_years,
              data_type: table_constants.TABLE_DATA_TYPES.SELECT,
              default_value: constants.season.year,
              single: true
            }
          }
        : period === 'Week'
          ? {
              year: {
                values: projection_years,
                data_type: table_constants.TABLE_DATA_TYPES.SELECT,
                default_value: constants.season.year,
                single: true
              },
              week: {
                values: constants.nfl_weeks,
                data_type: table_constants.TABLE_DATA_TYPES.SELECT,
                default_value: constants.season.week,
                single: true
              }
            }
          : undefined
  })

  return {
    ...create_field({
      base_name: 'points_added',
      title: 'Points Added',
      groups: [COLUMN_GROUPS.FANTASY_LEAGUE],
      label: 'Pts+',
      stat: 'points_added',
      options: { fixed: 1 }
    }),
    ...create_field({
      base_name: 'points',
      title: 'Points',
      groups: [COLUMN_GROUPS.FANTASY_POINTS],
      label: 'Pts',
      stat: 'proj_fan_pts',
      options: { fixed: 1 }
    }),
    ...create_field({
      base_name: 'pass_yds',
      title: 'Passing Yards',
      groups: [COLUMN_GROUPS.PASSING],
      label: 'YDS',
      stat: 'proj_pass_yds'
    }),
    ...create_field({
      base_name: 'pass_tds',
      title: 'Passing Touchdowns',
      groups: [COLUMN_GROUPS.PASSING],
      label: 'TD',
      stat: 'proj_pass_tds',
      options: { fixed: 1 }
    }),
    ...create_field({
      base_name: 'pass_ints',
      title: 'Interceptions',
      groups: [COLUMN_GROUPS.PASSING],
      label: 'INT',
      stat: 'proj_pass_ints',
      options: { fixed: 1 }
    }),
    ...create_field({
      base_name: 'rush_atts',
      title: 'Rushing Attempts',
      groups: [COLUMN_GROUPS.RUSHING],
      label: 'ATT',
      stat: 'proj_rush_atts'
    }),
    ...create_field({
      base_name: 'rush_yds',
      title: 'Rushing Yards',
      groups: [COLUMN_GROUPS.RUSHING],
      label: 'YDS',
      stat: 'proj_rush_yds'
    }),
    ...create_field({
      base_name: 'rush_tds',
      title: 'Rushing Touchdowns',
      groups: [COLUMN_GROUPS.RUSHING],
      label: 'TD',
      stat: 'proj_rush_tds',
      options: { fixed: 1 }
    }),
    ...create_field({
      base_name: 'fumbles_lost',
      title: 'Fumbles',
      groups: [COLUMN_GROUPS.RUSHING],
      label: 'FUM',
      stat: 'proj_fum_lost',
      options: { fixed: 1 }
    }),
    ...create_field({
      base_name: 'targets',
      title: 'Targets',
      groups: [COLUMN_GROUPS.RECEIVING],
      label: 'TGT',
      stat: 'proj_trg',
      options: { fixed: 1 }
    }),
    ...create_field({
      base_name: 'recs',
      title: 'Receptions',
      groups: [COLUMN_GROUPS.RECEIVING],
      label: 'REC',
      stat: 'proj_recs',
      options: { fixed: 1 }
    }),
    ...create_field({
      base_name: 'rec_yds',
      title: 'Receiving Yards',
      groups: [COLUMN_GROUPS.RECEIVING],
      label: 'YDS',
      stat: 'proj_rec_yds'
    }),
    ...create_field({
      base_name: 'rec_tds',
      title: 'Receiving Touchdowns',
      groups: [COLUMN_GROUPS.RECEIVING],
      label: 'TD',
      stat: 'proj_rec_tds',
      options: { fixed: 1 }
    })
  }
}
