import React from 'react'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'

import { constants } from '@common'

export default class SelectedPlayerValue extends React.Component {
  render = () => {
    const { player } = this.props

    const baData = []
    const wsData = []
    for (const week of constants.fantasyWeeks) {
      if (week < constants.season.week) continue
      baData.push(parseFloat(player.getIn(['vorp', `${week}`, 'available'], 0).toFixed(1)))
      wsData.push(parseFloat(player.getIn(['vorp', `${week}`, 'starter'], 0).toFixed(1)))
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
        categories: constants.fantasyWeeks.filter(w => w >= constants.season.week),
        title: {
          text: 'Week'
        },
        crosshair: true
      },
      yAxis: {
        min: 0,
        lineColor: '#cccccc',
        title: {
          text: 'Points Over Replacement',
          align: 'high'
        },
        labels: {
          overflow: 'justify'
        }
      },
      plotOptions: {
        column: {
          grouping: false,
          shadow: false,
          borderWidth: 0
        }
      },
      credits: {
        enabled: false
      },
      series: [{
        name: 'Worst Starter',
        data: wsData,
        pointPadding: 0.2
      }, {
        name: 'Best Available',
        data: baData,
        pointPadding: 0.4
      }]
    }

    return (
      <HighchartsReact
        highcharts={Highcharts}
        options={options}
      />
    )
  }
}
