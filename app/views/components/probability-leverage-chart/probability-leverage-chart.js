import React, { useState } from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import HighchartsMore from 'highcharts/highcharts-more'
import { ToggleButtonGroup, ToggleButton } from '@mui/material'

import './probability-leverage-chart.styl'

// Initialize HighchartsMore
HighchartsMore(Highcharts)

const ProbabilityLeverageChart = ({ teams }) => {
  const [chart_type, set_chart_type] = useState('playoffs')

  const chart_data = {
    playoffs: {
      title: 'Playoff Probability Leverage',
      data_key: 'playoff_odds'
    },
    bye: {
      title: 'Bye Probability Leverage',
      data_key: 'bye_odds'
    },
    championship: {
      title: 'Championship Probability Leverage',
      data_key: 'championship_odds'
    }
  }

  const current_data = chart_data[chart_type]

  const series_data = teams
    .map((team) => ({
      name: team.get('name'),
      low: team.get(`${current_data.data_key}_with_loss`),
      high: team.get(`${current_data.data_key}_with_win`),
      current: team.get(current_data.data_key),
      color: team.get('pc') ? `#${team.get('pc').toString(16)}` : null
    }))
    .toJS()

  // Sort series_data by current probability in descending order
  series_data.sort((a, b) => b.current - a.current)

  const chart_options = {
    chart: {
      type: 'columnrange',
      inverted: true
    },
    title: {
      text: current_data.title
    },
    xAxis: {
      categories: series_data.map((team) => team.name),
      title: {
        text: 'Teams'
      }
    },
    yAxis: {
      title: {
        text: 'Probability (%)'
      },
      min: 0,
      max: 100
    },
    credits: {
      enabled: false
    },
    tooltip: {
      valueSuffix: '%',
      formatter: function () {
        if (this.series.name === 'Probability Range') {
          return `<b>${this.x}</b><br/>
                  With Win: ${this.point.high.toFixed(2)}%<br/>
                  With Loss: ${this.point.low.toFixed(2)}%`
        } else {
          return `<b>${this.x}</b><br/>
                  Current Probability: ${this.y.toFixed(2)}%`
        }
      }
    },
    plotOptions: {
      columnrange: {
        dataLabels: {
          enabled: true,
          format: '{y:.0f}%'
        },
        colorByPoint: true
      }
    },
    legend: {
      enabled: true
    },
    series: [
      {
        name: 'Probability Range (with Win vs Loss)',
        data: series_data.map((data) => ({
          low: data.low * 100,
          high: data.high * 100,
          color: data.color
        }))
      },
      {
        name: 'Current Probability',
        type: 'scatter',
        data: series_data.map((data, index) => ({
          x: index,
          y: data.current * 100
        })),
        marker: {
          symbol: 'diamond',
          lineWidth: 1,
          lineColor: 'black'
        }
      }
    ]
  }

  const handle_toggle_change = (event, new_chart_type) => {
    if (new_chart_type !== null) {
      set_chart_type(new_chart_type)
    }
  }

  return (
    <div className='probability_leverage_chart'>
      <div className='chart_toggle'>
        <ToggleButtonGroup
          value={chart_type}
          exclusive
          onChange={handle_toggle_change}
          aria_label='chart type'
          size='small'
        >
          <ToggleButton value='playoffs' aria_label='playoffs'>
            Playoffs
          </ToggleButton>
          <ToggleButton value='bye' aria_label='bye'>
            Bye
          </ToggleButton>
          <ToggleButton value='championship' aria_label='championship'>
            Championship
          </ToggleButton>
        </ToggleButtonGroup>
      </div>
      <HighchartsReact highcharts={Highcharts} options={chart_options} />
      <div className='chart_explanation'>
        This chart shows the probability leverage for each team. The bar
        represents the range of probabilities, with the lower end showing the
        probability if the team loses their next game, and the higher end
        showing the probability if they win. The diamond marker indicates the
        current probability.
      </div>
    </div>
  )
}

ProbabilityLeverageChart.propTypes = {
  teams: ImmutablePropTypes.list.isRequired
}

export default ProbabilityLeverageChart
