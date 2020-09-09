import React from 'react'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'

import { constants } from '@common'

export default class SelectedPlayerLineupImpact extends React.Component {
  render = () => {
    const { isLoggedIn, player } = this.props

    if (!isLoggedIn) {
      return (<div>Must be logged in.</div>)
    }

    const spData = []
    const bpData = []
    for (const week in player.getIn(['lineups', 'weeks'], {})) {
      if (week >= constants.season.week) {
        spData.push(parseFloat(player.getIn(['lineups', 'weeks', week, 'sp'], 0).toFixed(1)))
        bpData.push(parseFloat(player.getIn(['lineups', 'weeks', week, 'bp'], 0).toFixed(1)))
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
      series: [{
        name: 'Starter Points Added',
        data: spData
      }, {
        name: 'Bench Points Added',
        data: bpData
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
