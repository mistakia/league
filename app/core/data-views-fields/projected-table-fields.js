import COLUMN_GROUPS from './column-groups'
import * as table_constants from 'react-table/src/constants.mjs'
import { constants, common_column_params } from '@libs-shared'

const { single_year, single_week, single_seas_type } = common_column_params

const projection_years = [2020, 2021, 2022, 2023, 2024]

export default function ({ week }) {
  const create_field = ({ base_name, title, groups, label, options = {} }) => ({
    [`player_week_projected_${base_name}`]: create_projection_field({
      title,
      period: 'Week',
      groups,
      label,
      base_name,
      options: { week, ...options }
    }),
    [`player_season_projected_${base_name}`]: create_projection_field({
      title,
      period: 'Season',
      groups,
      label,
      base_name,
      options
    }),
    [`player_rest_of_season_projected_${base_name}`]: create_projection_field({
      title,
      period: 'Rest-Of-Season',
      groups,
      label,
      base_name,
      options: { week: 'ros', ...options }
    })
  })

  const create_projection_field = ({
    title,
    period,
    groups,
    label,
    base_name,
    options = {}
  }) => ({
    column_title: `Projected ${title} (${period})`,
    column_groups: [
      COLUMN_GROUPS.PROJECTION,
      COLUMN_GROUPS[`${period.toUpperCase().replaceAll('-', '_')}_PROJECTION`],
      ...groups
    ],
    header_label: label,
    player_value_path: `${period.toLowerCase().replaceAll('-', '_')}_projected_${base_name}`,
    ...(options.fixed && { fixed: options.fixed }),
    ...(options.reverse_percentiles && { reverse_percentiles: true }),
    size: 70,
    splits:
      period === 'Season'
        ? ['year']
        : period === 'Week'
          ? ['year', 'week']
          : undefined,
    data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
    column_params:
      period === 'Season'
        ? {
            year: {
              ...single_year,
              default_value: constants.year,
              values: projection_years
            }
          }
        : period === 'Week'
          ? {
              year: {
                ...single_year,
                default_value: constants.year,
                values: projection_years
              },
              week: single_week,
              seas_type: single_seas_type
            }
          : undefined
  })

  return {
    ...create_field({
      base_name: 'points_added',
      title: 'Points Added',
      groups: [COLUMN_GROUPS.FANTASY_LEAGUE],
      label: 'Pts+',
      options: { fixed: 1 }
    }),
    ...create_field({
      base_name: 'points',
      title: 'Points',
      groups: [COLUMN_GROUPS.FANTASY_POINTS],
      label: 'Pts',
      options: { fixed: 1 }
    }),
    ...create_field({
      base_name: 'pass_atts',
      title: 'Passing Attempts',
      groups: [COLUMN_GROUPS.PASSING],
      label: 'ATT'
    }),
    ...create_field({
      base_name: 'pass_yds',
      title: 'Passing Yards',
      groups: [COLUMN_GROUPS.PASSING],
      label: 'YDS'
    }),
    ...create_field({
      base_name: 'pass_tds',
      title: 'Passing Touchdowns',
      groups: [COLUMN_GROUPS.PASSING],
      label: 'TD',
      options: { fixed: 1 }
    }),
    ...create_field({
      base_name: 'pass_ints',
      title: 'Interceptions',
      groups: [COLUMN_GROUPS.PASSING],
      label: 'INT',
      options: { fixed: 1, reverse_percentiles: true }
    }),
    ...create_field({
      base_name: 'rush_atts',
      title: 'Rushing Attempts',
      groups: [COLUMN_GROUPS.RUSHING],
      label: 'ATT'
    }),
    ...create_field({
      base_name: 'rush_yds',
      title: 'Rushing Yards',
      groups: [COLUMN_GROUPS.RUSHING],
      label: 'YDS'
    }),
    ...create_field({
      base_name: 'rush_tds',
      title: 'Rushing Touchdowns',
      groups: [COLUMN_GROUPS.RUSHING],
      label: 'TD',
      options: { fixed: 1 }
    }),
    ...create_field({
      base_name: 'fumbles_lost',
      title: 'Fumbles',
      groups: [COLUMN_GROUPS.RUSHING],
      label: 'FUM',
      options: { fixed: 1, reverse_percentiles: true }
    }),
    ...create_field({
      base_name: 'targets',
      title: 'Targets',
      groups: [COLUMN_GROUPS.RECEIVING],
      label: 'TGT',
      options: { fixed: 1 }
    }),
    ...create_field({
      base_name: 'recs',
      title: 'Receptions',
      groups: [COLUMN_GROUPS.RECEIVING],
      label: 'REC',
      options: { fixed: 1 }
    }),
    ...create_field({
      base_name: 'rec_yds',
      title: 'Receiving Yards',
      groups: [COLUMN_GROUPS.RECEIVING],
      label: 'YDS'
    }),
    ...create_field({
      base_name: 'rec_tds',
      title: 'Receiving Touchdowns',
      groups: [COLUMN_GROUPS.RECEIVING],
      label: 'TD',
      options: { fixed: 1 }
    })
  }
}
