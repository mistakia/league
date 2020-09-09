import React from 'react'

import { nth } from '@common'

export default class DashboardTeamSummary extends React.Component {
  render = () => {
    const {
      team, faabRank, capRank, cap, league, projectedPoint, projectedPointRank,
      projectedPointAvg
    } = this.props

    const tQuarter = Math.ceil(league.nteams / 4)
    const bQuarter = league.nteams - tQuarter
    const faabClassNames = []
    if (faabRank <= tQuarter) faabClassNames.push('text-green')
    else if (faabRank >= bQuarter) faabClassNames.push('text-red')

    const capClassNames = []
    if (capRank <= tQuarter) capClassNames.push('text-green')
    else if (capRank >= bQuarter) capClassNames.push('text-red')

    const woClassNames = []
    if (team.wo <= tQuarter) woClassNames.push('text-green')
    else if (team.wo >= bQuarter) woClassNames.push('text-red')

    const projectedPointClassNames = []
    if (projectedPointRank <= tQuarter) projectedPointClassNames.push('text-green')
    else if (projectedPointRank >= bQuarter) projectedPointClassNames.push('text-red')

    return (
      <div className='dashboard__section-side'>
        <div className='dashboard__section-side-title'>Summary</div>
        <div className='dashboard__section-side-body'>
          <table>
            <tbody>
              <tr>
                <td>Record</td>
                <td>-</td>
                <td>-</td>
              </tr>
              <tr>
                <td>Points</td>
                <td>-</td>
                <td>-</td>
              </tr>
              <tr>
                <td>Free Agent Auction Budget</td>
                <td>${team.faab}</td>
                <td className={faabClassNames.join(' ')}>{faabRank}{nth(faabRank)}</td>
              </tr>
              <tr>
                <td>Salary Space</td>
                <td>{cap ? `$${cap}` : '-'}</td>
                <td className={capClassNames.join(' ')}>
                  {capRank ? `${capRank}${nth(capRank)}` : '-'}
                </td>
              </tr>
              <tr>
                <td>Waiver Order</td>
                <td />
                <td className={woClassNames.join(' ')}>{team.wo}{nth(team.wo)}</td>
              </tr>
              <tr>
                <td>Proj. Record</td>
                <td>-</td>
                <td>-</td>
              </tr>
              <tr>
                <td>Proj. Points</td>
                <td>{projectedPoint} ({projectedPointAvg})</td>
                <td className={projectedPointClassNames.join(' ')}>
                  {projectedPointRank}{nth(projectedPointRank)}
                </td>
              </tr>
              <tr>
                <td>Championship Odds</td>
                <td>-</td>
                <td>-</td>
              </tr>
              <tr>
                <td>Playoff Odds</td>
                <td>-</td>
                <td>-</td>
              </tr>
              <tr>
                <td>Division Odds</td>
                <td>-</td>
                <td>-</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    )
  }
}
