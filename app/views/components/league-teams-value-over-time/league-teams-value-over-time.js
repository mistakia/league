import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'

import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import HighchartsSeriesLabel from 'highcharts/modules/series-label'

import { constants } from '#libs-shared'
import { Team } from '@core/teams'

HighchartsSeriesLabel(Highcharts)

export default function LeagueTeamsValueOverTime({
  load_league_team_daily_values,
  league_team_daily_values,
  teams,
  teams_value_deltas
}) {
  React.useEffect(() => {
    load_league_team_daily_values()
  }, [load_league_team_daily_values])
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

  teams.forEach((team) => {
    const team_values = league_team_daily_values.get(team.uid)
    if (!team_values) return
    const data = []
    team_values.forEach((item) => {
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
