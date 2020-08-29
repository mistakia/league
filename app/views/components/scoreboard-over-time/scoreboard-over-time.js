import React from 'react'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'

export default class ScoreboardOverTime extends React.Component {
  render = () => {
    const options = {
      chart: {
        zoomType: 'x',
        backgroundColor: 'transparent'
      },
      title: {
        text: ''
      },
      xAxis: {
        type: 'datetime'
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
        type: 'line',
        name: 'Home',
        data: []
      }, {
        type: 'line',
        name: 'Away',
        data: []
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
