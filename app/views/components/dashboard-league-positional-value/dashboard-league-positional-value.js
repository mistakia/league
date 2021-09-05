import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'

import { constants } from '@common'

export default class DashboardLeaguePositionalValue extends React.Component {
  render = () => {
    const { summary, teams } = this.props

    const series = []
    for (const position of constants.positions) {
      const data = []
      for (const tid in summary.rosters) {
        const rounded = parseInt(summary.rosters[tid][position].toFixed(1), 0)
        data.push(rounded)
      }
      series.push({ name: position, data, borderColor: 'transparent' })
    }

    const teamNames = []
    for (const tid in summary.rosters) {
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
        categories: teamNames
      },
      colors: [
        '#ff3f3f',
        '#3f9f3f',
        '#ffbb3f',
        '#3f3fff',
        '#9f9f9f',
        '#3f3f3f'
      ],
      yAxis: {
        min: 0,
        title: {
          text: 'Value'
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
