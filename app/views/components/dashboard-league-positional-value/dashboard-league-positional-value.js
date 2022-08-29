import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'
import Highcharts from 'highcharts'
import HighchartsCustomEvents from 'highcharts-custom-events'
import HighchartsReact from 'highcharts-react-official'

import { constants, sum } from '@common'

HighchartsCustomEvents(Highcharts)

export default class DashboardLeaguePositionalValue extends React.Component {
  render = () => {
    const { summary, teams } = this.props

    const series = []
    for (const position of constants.positions) {
      const data = []
      for (const { tid } of summary.sorted_tids) {
        const rounded = parseInt(summary.rosters[tid][position].toFixed(1), 0)
        data.push(rounded)
      }
      series.push({ name: position, data, borderColor: 'transparent' })
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
      borderColor: 'transparent'
    })

    const teamNames = []
    for (const { tid } of summary.sorted_tids) {
      const id = parseInt(tid, 10)
      const name = teams.getIn([id, 'name'])
      teamNames.push(name)
    }

    const options = {
      chart: {
        type: 'bar',
        backgroundColor: 'transparent'
      },
      title: {
        text: ''
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
          text: 'Projected Points Added (Team Value)'
        }
      },
      legend: {
        reversed: true
      },
      plotOptions: {
        series: {
          stacking: 'normal'
        }
      },
      credits: {
        enabled: false
      },
      series
    }

    return (
      <div className='dashboard__section-side'>
        <div className='dashboard__section-side-body'>
          <HighchartsReact highcharts={Highcharts} options={options} />
        </div>
      </div>
    )
  }
}

DashboardLeaguePositionalValue.propTypes = {
  teams: ImmutablePropTypes.map,
  summary: PropTypes.object
}
