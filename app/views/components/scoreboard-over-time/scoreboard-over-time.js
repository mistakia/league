import React from 'react'
import Highcharts from 'highcharts/highstock'
import HighchartsReact from 'highcharts-react-official'

import './scoreboard-over-time.styl'

export default class ScoreboardOverTime extends React.Component {
  render = () => {
    const options = {
      chart: {
        zoomType: 'x',
        type: 'spline',
        backgroundColor: 'transparent'
      },
      title: {
        text: ''
      },
      xAxis: {
        type: 'datetime',
        ordinal: false,
        breaks: this.props.breaks
      },
      yAxis: {
        title: {
          text: 'Points'
        }
      },
      legend: {
        enabled: false
      },
      credits: {
        enabled: false
      },
      series: [{
        name: 'Home',
        data: this.props.homeData
      }, {
        name: 'Away',
        data: this.props.awayData
      }]
    }

    return (
      <div className='scoreboard__over-time'>
        <HighchartsReact
          highcharts={Highcharts}
          options={options}
        />
      </div>
    )
  }
}
