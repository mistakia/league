import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import ToggleButton from '@mui/material/ToggleButton'

import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import 'highcharts/modules/series-label'

import { constants } from '#libs-shared'
import { Team } from '@core/teams'

import './league-teams-value-over-time.styl'

export default function LeagueTeamsValueOverTime({
  load_league_team_daily_values,
  league_team_daily_values,
  teams,
  teams_value_deltas
}) {
  React.useEffect(() => {
    load_league_team_daily_values()
  }, [load_league_team_daily_values])

  const [date_range, set_date_range] = React.useState(0)

  const handle_change = (event, new_date_range) => {
    set_date_range(new_date_range)
  }

  const series = []
  const colors = []

  let color_index = 0
  const next_color = () => {
    color_index += 1
    return constants.colors[color_index - 1]
  }

  // find team with highest value
  let max_value = 0
  let min_value = Infinity
  let highest_value_team = null
  let lowest_value_team = null
  teams.forEach((team) => {
    const team_values = league_team_daily_values.get(team.uid)
    if (!team_values) return
    const most_recent_value = team_values.last()
    if (most_recent_value && most_recent_value.ktc_value > max_value) {
      max_value = most_recent_value.ktc_value
      highest_value_team = team
    }

    if (most_recent_value && most_recent_value.ktc_value < min_value) {
      min_value = most_recent_value.ktc_value
      lowest_value_team = team
    }
  })

  const current_timestamp = Date.now()

  teams.forEach((team) => {
    const team_values = league_team_daily_values.get(team.uid)
    if (!team_values) return
    const data = []
    team_values.forEach((item) => {
      // if date range is set, only show values within that range
      if (date_range) {
        const date_range_timestamp =
          current_timestamp - date_range * 24 * 60 * 60 * 1000
        if (item.timestamp < date_range_timestamp) return
      }

      data.push([item.timestamp, item.ktc_value])
    })
    const item = {
      tid: team.uid,
      name: team.name,
      data
    }

    if (
      team.uid !== highest_value_team.uid &&
      team.uid !== lowest_value_team.uid
    ) {
      item.label = {
        enabled: false
      }
    }

    series.push(item)

    const team_color = team.pc ? `#${team.pc}` : next_color()
    colors.push(team_color)
  })

  const options = {
    chart: {
      type: 'line'
    },

    title: {
      text: null
    },

    xAxis: {
      type: 'datetime',
      labels: {
        formatter: function () {
          return Highcharts.dateFormat('%b %Y', this.value)
        }
      }
    },

    legend: {
      labelFormatter: function () {
        const team = teams.get(this.options.tid, new Team())
        const team_delta_value = teams_value_deltas.get(this.options.tid)
        const latest_team_value = team_delta_value.get(
          'latest_team_value',
          null
        )

        if (latest_team_value) {
          return `${team.name} ($${latest_team_value.toFixed(0)})`
        }

        return this.name
      }
    },

    yAxis: {
      title: {
        text: 'Team Market Value'
      }
    },

    credits: {
      enabled: false
    },

    plotOptions: {
      series: {
        label: {
          connectorAllowed: false
        }
      }
    },

    series,
    colors
  }

  return (
    <div>
      <div className='league-teams-value-header'>
        <ToggleButtonGroup
          value={date_range}
          exclusive
          onChange={handle_change}
          className='league-teams-value-date-range'
        >
          <ToggleButton value={30}>1M</ToggleButton>
          <ToggleButton value={90}>3M</ToggleButton>
          <ToggleButton value={180}>6M</ToggleButton>
          <ToggleButton value={365}>1Y</ToggleButton>
          <ToggleButton value={0}>ALL</ToggleButton>
        </ToggleButtonGroup>
      </div>
      <HighchartsReact highcharts={Highcharts} options={options} />
    </div>
  )
}

LeagueTeamsValueOverTime.propTypes = {
  load_league_team_daily_values: PropTypes.func.isRequired,
  league_team_daily_values: ImmutablePropTypes.map.isRequired,
  teams: ImmutablePropTypes.map.isRequired,
  teams_value_deltas: ImmutablePropTypes.map.isRequired
}
