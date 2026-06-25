import COLUMN_GROUPS from './column-groups'
import * as table_constants from 'react-table/src/constants.mjs'
import {
  common_column_params,
  named_scoring_formats,
  named_league_formats,
  projection_source_param,
  DEFAULT_SCORING_FORMAT_ID,
  DEFAULT_LEAGUE_FORMAT_ID
} from '@libs-shared'
import { current_season } from '@constants'

const { single_year, nfl_week_id } = common_column_params

const scoring_format_id_param = {
  label: 'Scoring Format',
  values: Object.values(named_scoring_formats).map((format) => ({
    value: format.id,
    label: format.label
  })),
  data_type: table_constants.TABLE_DATA_TYPES.SELECT,
  default_value: DEFAULT_SCORING_FORMAT_ID,
  single: true
}

const league_format_id_param = {
  label: 'League Format',
  values: Object.values(named_league_formats).map((format) => ({
    value: format.id,
    label: format.label
  })),
  data_type: table_constants.TABLE_DATA_TYPES.SELECT,
  default_value: DEFAULT_LEAGUE_FORMAT_ID,
  single: true
}

// market_salary is auction-only: DFS formats publish per-player salaries
// externally (player_salaries) and write NULL into the projection table.
// Restrict the picker so the UI doesn't surface a column that would always
// be empty for the selected format.
const auction_league_format_id_param = {
  ...league_format_id_param,
  values: Object.values(named_league_formats)
    .filter((format) => (format.pricing_model || 'auction') === 'auction')
    .map((format) => ({ value: format.id, label: format.label }))
}

const extra_column_params_by_base_name = {
  points: { scoring_format_id: scoring_format_id_param },
  points_added: { league_format_id: league_format_id_param },
  market_salary: { league_format_id: auction_league_format_id_param }
}

// These columns are derived into league_format_*/league_* valuation tables that
// carry no sourceid dimension, so they accept no source picker. `points` is NOT
// among them: it is now computed in-query from projections_index/ros_projections
// (see player-projected-column-definitions.mjs) and so accepts a source picker
// alongside its scoring-format picker, like every raw-stat projection column.
const computed_base_names = new Set([
  'points_added',
  'market_salary',
  'salary_adjusted_points_added'
])

const get_extra_column_params = (base_name) => ({
  ...(computed_base_names.has(base_name)
    ? {}
    : { sourceid: projection_source_param }),
  ...extra_column_params_by_base_name[base_name]
})

// Generate projection years dynamically from 2020 to current year
const get_projection_years = () => {
  const years = []
  for (let year = 2020; year <= current_season.year; year++) {
    years.push(year)
  }
  return years
}

const projection_years = get_projection_years()

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
    row_axes:
      period === 'Season'
        ? ['year']
        : period === 'Week'
          ? ['year', 'week']
          : undefined,
    data_type: table_constants.TABLE_DATA_TYPES.NUMBER,
    column_params: (() => {
      const extras = get_extra_column_params(base_name)
      if (period === 'Season') {
        return {
          year: {
            ...single_year,
            default_value: current_season.year,
            values: projection_years
          },
          ...extras
        }
      }
      if (period === 'Week') {
        return { nfl_week_id, ...extras }
      }
      return extras
    })()
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
