import React from 'react'
import PropTypes from 'prop-types'
import Highcharts from 'highcharts'
import HighchartsReact from 'highcharts-react-official'
import HighchartsMore from 'highcharts/highcharts-more'

import { constants, nth } from '@common'

HighchartsMore(Highcharts)

export default class DashboardTeamValue extends React.Component {
  render = () => {
    const { summary, league, quarterOfLeague, allRank } = this.props

    const allClassNames = []
    if (allRank <= quarterOfLeague) allClassNames.push('text-green')
    if (allRank >= league.num_teams - quarterOfLeague) {
      allClassNames.push('text-red')
    }

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
    constants.positions.forEach((position, idx) => {
      const values = summary.league[position].sort((a, b) => b - a)
      const value = summary.team[position] || 0
      const rank = values.indexOf(value) + 1
      const classNames = []
      if (rank <= quarterOfLeague) classNames.push('text-green')
      if (rank >= league.num_teams - quarterOfLeague)
        classNames.push('text-red')
      rows.push(
        <tr key={idx}>
          <td>{position}</td>
          <td>{value.toFixed(1)}</td>
          <td className={classNames.join(' ')}>{`${rank}${nth(rank)}`}</td>
        </tr>
      )
    })

    const draft_values = summary.league.DRAFT.sort((a, b) => b - a)
    const draft_value = summary.team.DRAFT || 0
    const draft_rank = draft_values.indexOf(draft_value) + 1
    const classNames = []
    if (draft_rank <= quarterOfLeague) classNames.push('text-green')
    if (draft_rank >= league.num_teams - quarterOfLeague)
      classNames.push('text-red')
    rows.push(
      <tr key={'DRAFT'}>
        <td>Draft</td>
        <td>{draft_value.toFixed(1)}</td>
        <td className={classNames.join(' ')}>{`${draft_rank}${nth(
          draft_rank
        )}`}</td>
      </tr>
    )

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
        categories: [...constants.positions, 'Draft'],
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

DashboardTeamValue.propTypes = {
  summary: PropTypes.object,
  league: PropTypes.object,
  quarterOfLeague: PropTypes.number,
  allRank: PropTypes.number
}
