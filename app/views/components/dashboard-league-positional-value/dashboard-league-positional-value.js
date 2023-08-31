import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'
import Highcharts from 'highcharts'
import HighchartsCustomEvents from 'highcharts-custom-events'
import HighchartsReact from 'highcharts-react-official'

import { sum } from '@libs-shared'

HighchartsCustomEvents(Highcharts)

export default function DashboardLeaguePositionalValue({
  summary,
  teams,
  league_positions
}) {
  const series = []
  for (const position of league_positions) {
    const data = []
    for (const { tid } of summary.sorted_tids) {
      const rounded = parseInt(summary.rosters[tid][position].toFixed(1), 10)
      data.push(rounded)
    }
    series.push({
      name: position,
      data,
      borderColor: 'transparent',
      animation: false
    })
  }

  const draft_data = []
  for (const { tid } of summary.sorted_tids) {
    const draft_value = summary.rosters[tid].DRAFT
      ? summary.rosters[tid].DRAFT.toFixed(1)
      : 0
    const rounded = parseInt(draft_value, 10)
    draft_data.push(rounded)
  }
  series.push({
    name: 'Draft Picks',
    data: draft_data,
    borderColor: 'transparent',
    animation: false
  })

  const teamNames = []
  for (const { tid } of summary.sorted_tids) {
    const id = parseInt(tid, 10)
    const name = teams.getIn([id, 'name'])
    teamNames.push(name || '')
  }

  const options = {
    chart: {
      animation: false,
      type: 'bar',
      backgroundColor: 'transparent'
    },
    title: {
      text: 'Projected Points+'
    },
    xAxis: {
      categories: teamNames,
      labels: {
        events: {
          mouseover: function (e) {
            const chart = this.chart
            if (chart.myLabel) {
              chart.myLabel.destroy()
              delete chart.myLabel
            }
            const values = chart.series
              .filter((s) => s.visible)
              .map((s) => s.yData[this.pos])
            const value = sum(values)
            chart.myLabel = chart.renderer
              .label(value, e.layerX + 8, e.layerY, 'rectangle', true)
              .css({
                color: '#FFFFFF'
              })
              .attr({
                fill: 'rgba(0, 0, 0, 0.75)',
                padding: 8,
                r: 4
              })
              .add()
              .toFront()
          },
          mouseout: function (e) {
            const chart = this.chart
            if (chart.myLabel) {
              chart.myLabel.destroy()
              delete chart.myLabel
            }
          }
        }
      }
    },
    colors: [
      '#ff3f3f',
      '#3f9f3f',
      '#ffbb3f',
      '#3f3fff',
      '#9f9f9f',
      '#3f3f3f',
      '#800080'
    ],
    yAxis: {
      min: 0,
      title: {
        text: 'Projected Points+'
      }
    },
    legend: {
      reversed: true
    },
    plotOptions: {
      series: {
        stacking: 'normal',
        events: {
          legendItemClick: function (event) {
            const name = this.name
            // visible flag not updated yet so use reverse
            const visible = !this.visible
            const teams = {}
            for (const series of this.chart.series) {
              if (
                (series.name === name && !visible) ||
                (series.name !== name && !series.visible)
              )
                continue

              // sum values for each team
              series.xData.forEach((x_index, index) => {
                if (!teams[x_index]) {
                  teams[x_index] = series.yData[index]
                } else {
                  teams[x_index] += series.yData[index]
                }
              })
            }

            // sort totals
            const sorted_teams = Object.entries(teams).sort(
              (a, b) => b[1] - a[1]
            )

            const series = []
            for (const current_series of this.chart.series) {
              const data = []
              for (const item of sorted_teams) {
                const team_index = item[0]
                const series_value = current_series.yData[team_index]
                data.push(series_value)
              }
              series.push({
                name: current_series.name,
                data,
                borderColor: 'transparent'
              })
            }

            const teamNames = []
            for (const item of sorted_teams) {
              const team_index = item[0]
              const name = this.chart.xAxis[0].categories[team_index]
              teamNames.push(name)
            }

            this.chart.update({
              xAxis: {
                categories: teamNames
              },
              series
            })
          }
        }
      }
    },
    credits: {
      enabled: false
    },
    series
  }

  return <HighchartsReact highcharts={Highcharts} options={options} />
}

DashboardLeaguePositionalValue.propTypes = {
  teams: ImmutablePropTypes.map,
  summary: PropTypes.object,
  league_positions: PropTypes.array
}
