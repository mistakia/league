import React from 'react'
import PropTypes from 'prop-types'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'

import './league-team-value-over-time.styl'

export default function LeagueTeamValueOverTime({ series_data }) {
  const [latest_team_market_value, set_latest_team_market_value] =
    React.useState('-')

  React.useEffect(() => {
    if (series_data.length > 0) {
      set_latest_team_market_value(
        series_data[series_data.length - 1][1].toFixed(0)
      )
    }
  }, [series_data])

  const options = {
    chart: {
      backgroundColor: 'transparent',
      height: 60,
      width: '560',
      type: 'line',
      marginTop: 0,
      marginBottom: 0
    },
    pane: {
      size: '100%'
    },
    title: {
      text: null
    },
    xAxis: {
      type: 'datetime',
      lineWidth: 0,
      tickLength: 0,
      labels: {
        enabled: false
      }
    },
    yAxis: {
      min: Math.min(...series_data.map((d) => d[1])),
      title: {
        text: null
      },
      gridLineWidth: 0,
      labels: {
        enabled: false
      }
    },
    legend: {
      enabled: false
    },
    series: [
      {
        name: 'Market Value',
        height: 60,
        data: series_data,
        label: {
          enabled: false
        }
      }
    ],
    tooltip: {
      crosshairs: {
        dashStyle: 'solid'
      },
      shared: true,
      formatter: function () {
        set_latest_team_market_value(this.points[0].y.toFixed(0))
        return (
          '<span style="font-size: 10px">' +
          Highcharts.dateFormat('%Y-%m-%d', this.x) +
          '</span><br/>'
        )
      },
      positioner: function (labelWidth, labelHeight, point) {
        const half_label_width = labelWidth / 2
        const x = point.plotX - half_label_width
        const y = this.chart.plotHeight - 25
        return { x, y }
      },
      backgroundColor: 'none',
      borderWidth: 0,
      shadow: false,
      useHTML: true,
      style: {
        padding: 0
      }
    },
    credits: {
      enabled: false
    }
  }

  return (
    <div className='league__team-value-over-time'>
      <HighchartsReact highcharts={Highcharts} options={options} />
      <div className='league__team-current-value'>
        <div className='league__team-current-value-label'>
          Team Market Value
        </div>
        ${latest_team_market_value}
      </div>
    </div>
  )
}

LeagueTeamValueOverTime.propTypes = {
  series_data: PropTypes.array.isRequired
}
