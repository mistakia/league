import React from 'react'
import Highcharts from 'highcharts/highstock'
import HighchartsReact from 'highcharts-react-official'

import './scoreboard-over-time.styl'

const timezone = new Date().getTimezoneOffset()
Highcharts.setOptions({
  global: {
    timezoneOffset: timezone
  }
})

export default class ScoreboardOverTime extends React.Component {
  render = () => {
    const { home, away } = this.props
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
        name: home.name,
        data: this.props.homeData,
        color: 'red'
      }, {
        name: away.name,
        data: this.props.awayData,
        color: 'black'
      }, {
        name: `${home.name} Projection`,
        data: this.props.homeProjection,
        dashStyle: 'DashDot',
        color: 'red'
      }, {
        name: `${away.name} Projection`,
        data: this.props.awayProjection,
        dashStyle: 'DashDot',
        color: 'black'
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
