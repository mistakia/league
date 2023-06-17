import React from 'react'
import PropTypes from 'prop-types'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'

import { constants } from '@libs-shared'

export default class SelectedPlayerValue extends React.Component {
  render = () => {
    const { baData, wsData } = this.props

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
      series: [
        {
          name: 'Worst Starter',
          borderColor: 'transparent',
          data: wsData,
          pointPadding: 0.2
        },
        {
          name: 'Best Available',
          borderColor: 'transparent',
          data: baData,
          pointPadding: 0.4
        }
      ]
    }

    return <HighchartsReact highcharts={Highcharts} options={options} />
  }
}

SelectedPlayerValue.propTypes = {
  baData: PropTypes.array,
  wsData: PropTypes.array
}
