import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'
import Highcharts from 'highcharts'
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
    const { data } = this.props
    const series = []
    const colors = ['red', 'black', 'green', 'blue']
    data.forEach((team, index) => {
      series.push({
        name: team.team.name,
        data: team.data,
        color: colors[index]
      })

      series.push({
        name: `${team.team.name} Projection`,
        data: team.projection,
        dashStyle: 'DashDot',
        color: colors[index]
      })
    })

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
        enabled: true
      },
      credits: {
        enabled: false
      },
      series
    }

    return (
      <div className='scoreboard__over-time'>
        <HighchartsReact highcharts={Highcharts} options={options} />
      </div>
    )
  }
}

ScoreboardOverTime.propTypes = {
  data: ImmutablePropTypes.list,
  breaks: PropTypes.array
}
