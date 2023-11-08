import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'

import { constants } from '@libs-shared'

export default class SelectedPlayerLineupImpact extends React.Component {
  render = () => {
    const { is_logged_in, playerMap } = this.props

    if (!is_logged_in) {
      return <div>Must be logged in.</div>
    }

    const spData = []
    const bpData = []
    for (const week in playerMap.getIn(['lineups', 'weeks'], {})) {
      if (week >= constants.week) {
        spData.push(
          parseFloat(
            playerMap.getIn(['lineups', 'weeks', week, 'sp'], 0).toFixed(1)
          )
        )
        bpData.push(
          parseFloat(
            playerMap.getIn(['lineups', 'weeks', week, 'bp'], 0).toFixed(1)
          )
        )
      }
    }

    const options = {
      chart: {
        type: 'column',
        backgroundColor: 'transparent'
      },
      title: {
        text: ''
      },
      xAxis: {
        categories: constants.fantasyWeeks.filter((w) => w >= constants.week),
        title: {
          text: 'Week'
        },
        crosshair: true
      },
      yAxis: {
        min: 0,
        lineColor: '#cccccc',
        title: {
          text: 'Points Added',
          align: 'high'
        },
        labels: {
          overflow: 'justify'
        }
      },
      plotOptions: {
        bar: {
          dataLabels: {
            enabled: true
          }
        }
      },
      credits: {
        enabled: false
      },
      series: [
        {
          name: 'Starter Points Added',
          borderColor: 'transparent',
          data: spData
        },
        {
          name: 'Bench Points Added',
          borderColor: 'transparent',
          data: bpData
        }
      ]
    }

    return <HighchartsReact highcharts={Highcharts} options={options} />
  }
}

SelectedPlayerLineupImpact.propTypes = {
  is_logged_in: PropTypes.bool,
  playerMap: ImmutablePropTypes.map
}
