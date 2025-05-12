import React, { useMemo } from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'
import Highcharts from 'highcharts'
import HighchartsCustomEvents from 'highcharts-custom-events'
import HighchartsReact from 'highcharts-react-official'

import { sum } from '@libs-shared'

HighchartsCustomEvents(Highcharts)

// Chart color palette
const CHART_COLORS = [
  '#ff3f3f', // Red
  '#3f9f3f', // Green
  '#ffbb3f', // Yellow
  '#3f3fff', // Blue
  '#9f9f9f', // Light Gray
  '#3f3f3f', // Dark Gray
  '#800080' // Purple
]

export default function DashboardLeaguePositionalValue({
  summary,
  teams,
  league_positions
}) {
  const { team_names, chart_series } = useMemo(() => {
    // Prepare team names
    const team_names = []
    for (const { tid } of summary.sorted_tids) {
      const id = parseInt(tid, 10)
      const name = teams.getIn([id, 'name'])
      team_names.push(name || '')
    }

    // Prepare series data
    const chart_series = []

    // Add position data
    for (const position of league_positions) {
      const data = []
      for (const { tid } of summary.sorted_tids) {
        const rounded = parseInt(summary.rosters[tid][position].toFixed(1), 10)
        data.push(rounded)
      }
      chart_series.push({
        name: position,
        data,
        borderColor: 'transparent',
        animation: false
      })
    }

    // Add draft picks data
    const draft_data = []
    for (const { tid } of summary.sorted_tids) {
      const draft_value = summary.rosters[tid].DRAFT
        ? summary.rosters[tid].DRAFT.toFixed(1)
        : 0
      const rounded = parseInt(draft_value, 10)
      draft_data.push(rounded)
    }
    chart_series.push({
      name: 'Draft Picks',
      data: draft_data,
      borderColor: 'transparent',
      animation: false
    })

    return { team_names, chart_series }
  }, [summary, teams, league_positions])

  const chart_options = useMemo(() => {
    return {
      chart: {
        animation: false,
        type: 'bar',
        backgroundColor: 'transparent'
      },
      title: {
        text: 'Projected Points+'
      },
      xAxis: {
        categories: team_names,
        labels: {
          events: {
            mouseover: function (e) {
              const chart = this.chart
              if (chart.myLabel) {
                chart.myLabel.destroy()
                delete chart.myLabel
              }

              // Get visible series data at this position
              const pos = this.pos
              const values = []

              chart.series.forEach((series) => {
                if (!series.visible) return

                // Try to get the value from points
                const point = series.points && series.points[pos]
                if (point && typeof point.y === 'number') {
                  values.push(point.y)
                }
              })

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
            mouseout: function () {
              const chart = this.chart
              if (chart.myLabel) {
                chart.myLabel.destroy()
                delete chart.myLabel
              }
            }
          }
        }
      },
      colors: CHART_COLORS,
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
            legendItemClick: function () {
              // Use setTimeout to delay execution until after the visible property is updated
              setTimeout(() => {
                const name = this.name
                const visible = this.visible
                const teams = {}

                // Check if this click will show a previously hidden series
                const will_have_visible_series =
                  visible ||
                  this.chart.series.some((s) => s.name !== name && s.visible)

                // If no visible series after this click, return without updating
                if (!will_have_visible_series) {
                  return
                }

                for (const series of this.chart.series) {
                  if (series.visible) {
                    // Get data for this series since it will become visible
                    series.userOptions.data.forEach((value, index) => {
                      if (!teams[index]) {
                        teams[index] = value
                      } else {
                        teams[index] += value
                      }
                    })
                  }
                }

                // If teams object is empty, don't proceed with sorting
                if (Object.keys(teams).length === 0) {
                  return
                }

                // sort totals
                const sorted_teams = Object.entries(teams).sort(
                  (a, b) => b[1] - a[1]
                )

                const new_series = []
                for (const current_series of this.chart.series) {
                  const data = []
                  const original_data = current_series.userOptions.data

                  for (const item of sorted_teams) {
                    const team_index = parseInt(item[0], 10)
                    const point_value = original_data[team_index]
                    data.push(point_value)
                  }

                  new_series.push({
                    name: current_series.name,
                    data,
                    borderColor: 'transparent'
                  })
                }

                const new_team_names = []
                for (const item of sorted_teams) {
                  const team_index = parseInt(item[0], 10)
                  const name = this.chart.xAxis[0].categories[team_index]
                  new_team_names.push(name)
                }

                this.chart.update({
                  xAxis: {
                    categories: new_team_names
                  },
                  series: new_series
                })
              }, 0)

              // Return true to allow the default legend toggle behavior
              return true
            }
          }
        }
      },
      credits: {
        enabled: false
      },
      series: chart_series
    }
  }, [team_names, chart_series])

  return <HighchartsReact highcharts={Highcharts} options={chart_options} />
}

DashboardLeaguePositionalValue.propTypes = {
  teams: ImmutablePropTypes.map,
  summary: PropTypes.object,
  league_positions: PropTypes.array
}
