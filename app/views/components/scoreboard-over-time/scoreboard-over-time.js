import React from 'react'
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

export default function ScoreboardOverTime({ breaks, series }) {
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
      breaks
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
      <HighchartsReact highcharts={Highcharts} options={options} immutable />
    </div>
  )
}

ScoreboardOverTime.propTypes = {
  breaks: PropTypes.array,
  series: PropTypes.array
}
