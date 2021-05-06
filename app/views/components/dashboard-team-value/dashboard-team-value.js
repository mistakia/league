import React from 'react'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import HighchartsMore from 'highcharts/highcharts-more'

import { constants, nth } from '@common'

HighchartsMore(Highcharts)

export default class DashboardTeamValue extends React.Component {
  render = () => {
    const { summary, league } = this.props
    const quarterOfLeague = Math.ceil(league.nteams / 4)

    const allValues = Object.values(summary.total).sort((a, b) => b - a)
    const allRank = allValues.indexOf(summary.team_total) + 1
    const allClassNames = []
    if (allRank <= quarterOfLeague) allClassNames.push('text-green')
    if (allRank >= league.nteams - quarterOfLeague)
      allClassNames.push('text-red')

    const rows = []
    rows.push(
      <tr key='overall'>
        <td>All</td>
        <td>{(summary.team_total || 0).toFixed(1)}</td>
        <td className={allClassNames.join(' ')}>{`${allRank}${nth(
          allRank
        )}`}</td>
      </tr>
    )
    for (const [index, position] of constants.positions.entries()) {
      const values = summary.league[position].sort((a, b) => b - a)
      const value = summary.team[position] || 0
      const rank = values.indexOf(value) + 1
      const classNames = []
      if (rank <= quarterOfLeague) classNames.push('text-green')
      if (rank >= league.nteams - quarterOfLeague) classNames.push('text-red')
      rows.push(
        <tr key={index}>
          <td>{position}</td>
          <td>{value.toFixed(1)}</td>
          <td className={classNames.join(' ')}>{`${rank}${nth(rank)}`}</td>
        </tr>
      )
    }

    const options = {
      chart: {
        polar: true,
        backgroundColor: 'transparent',
        type: 'line'
      },

      pane: {
        size: '100%'
      },

      title: {
        text: null
      },

      xAxis: {
        categories: constants.positions,
        lineColor: '#cccccc',
        tickmarkPlacement: 'on',
        lineWidth: 0
      },

      yAxis: {
        gridLineInterpolation: 'polygon',
        gridLineColor: '#cccccc',
        lineWidth: 0,
        min: 0
      },

      legend: {
        align: 'right',
        verticalAlign: 'middle',
        layout: 'vertical'
      },

      credits: {
        enabled: false
      },

      series: [
        {
          type: 'area',
          name: 'Team',
          data: Object.values(summary.team).map((v) =>
            parseFloat(v.toFixed(1))
          ),
          pointPlacement: 'on'
        },
        {
          name: 'League Avg.',
          data: Object.values(summary.league_avg).map((v) =>
            parseFloat(v.toFixed(1))
          ),
          pointPlacement: 'on'
        },
        {
          name: 'Division Avg.',
          data: Object.values(summary.div_avg).map((v) =>
            parseFloat(v.toFixed(1))
          ),
          pointPlacement: 'on',
          visible: false
        }
      ],

      responsive: {
        rules: [
          {
            condition: {
              maxWidth: 500
            },
            chartOptions: {
              legend: {
                align: 'center',
                verticalAlign: 'bottom',
                layout: 'horizontal'
              },
              pane: {
                size: '70%'
              }
            }
          }
        ]
      }
    }

    return (
      <div className='dashboard__section-side'>
        <div className='dashboard__section-side-title'>Positional value</div>
        <div className='dashboard__section-side-body'>
          <HighchartsReact highcharts={Highcharts} options={options} />
          <table>
            <tbody>{rows}</tbody>
          </table>
        </div>
      </div>
    )
  }
}
