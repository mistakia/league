import React from 'react'
import PropTypes from 'prop-types'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'

import './trade-team-summary.styl'

function Percentage(type, analysis) {
  if (!analysis.after[type] || !analysis.before[type]) return '-'
  const delta = analysis.after[type] - analysis.before[type]
  const isPositive = delta >= 0
  const sign = isPositive ? '+' : '-'
  const deltaPct = ((delta / analysis.before[type]) * 100 || 0).toFixed(1)
  const classNames = ['trade__percentage']
  if (isPositive) {
    classNames.push('positive')
  } else {
    classNames.push('negative')

    if (deltaPct > -1.5) {
      classNames.push('warning')
    }
  }

  return (
    <div className={classNames.join(' ')}>
      {`${sign}${Math.abs(deltaPct)}%`}
    </div>
  )
}

export default class TradeTeamSummary extends React.Component {
  render = () => {
    const { analysis } = this.props

    const pctPoints = Percentage('points', analysis)
    const pctValue = Percentage('value', analysis)
    const pctValueAdj = Percentage('value_adj', analysis)
    const pctDraftValue = Percentage('draft_value', analysis)
    const pctPlayerValue = Percentage('player_value', analysis)

    return (
      <>
        <TableContainer className='trade__summary-section'>
          <Table size='small'>
            <TableHead>
              <TableRow>
                <TableCell align='center' colSpan={3}>
                  {analysis.team.name || 'Summary'}
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell component='th' scope='row'>
                  Points
                </TableCell>
                <TableCell align='right'>
                  <div className='metric'>
                    {analysis.after.points || analysis.before.points || '-'}
                  </div>
                </TableCell>
                <TableCell>{pctPoints}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell component='th' scope='row'>
                  Overall Value
                </TableCell>
                <TableCell align='right'>
                  <div className='metric'>
                    {analysis.after.value
                      ? analysis.after.value.toFixed(1)
                      : '-'}
                  </div>
                </TableCell>
                <TableCell>{pctValue}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell component='th' scope='row'>
                  Player Value
                </TableCell>
                <TableCell align='right'>
                  <div className='metric'>
                    {analysis.after.player_value
                      ? analysis.after.player_value.toFixed(1)
                      : '-'}
                  </div>
                </TableCell>
                <TableCell>{pctPlayerValue}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell component='th' scope='row'>
                  Player Salary Adjusted Value
                </TableCell>
                <TableCell align='right'>
                  <div className='metric'>
                    {analysis.after.value_adj
                      ? analysis.after.value_adj.toFixed(1)
                      : '-'}
                  </div>
                </TableCell>
                <TableCell>{pctValueAdj}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell component='th' scope='row'>
                  Draft Value
                </TableCell>
                <TableCell align='right'>
                  <div className='metric'>
                    {analysis.after.draft_value
                      ? analysis.after.draft_value.toFixed(1)
                      : '-'}
                  </div>
                </TableCell>
                <TableCell>{pctDraftValue}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell component='th' scope='row'>
                  Team Salary
                </TableCell>
                <TableCell align='right'>
                  <div className='metric'>{analysis.after.salary || '-'}</div>
                </TableCell>
                <TableCell>
                  <div className='trade__percentage metric'>
                    {analysis.after.salary - analysis.before.salary || '-'}
                  </div>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
        {/* <TableContainer className='trade__summary-section'>
            <Table size='small'>
            <TableBody>
            <TableRow>
            <TableCell component='th' scope='row'>
            Record
            </TableCell>
            <TableCell />
            </TableRow>
            <TableRow>
            <TableCell component='th' scope='row'>
            Playoff Odds
            </TableCell>
            <TableCell align='right' />
            </TableRow>
            <TableRow>
            <TableCell component='th' scope='row'>
            Championship Odds
            </TableCell>
            <TableCell align='right' />
            </TableRow>
            <TableRow>
            <TableCell component='th' scope='row'>
            Roster Space
            </TableCell>
            <TableCell align='right' />
            </TableRow>
            </TableBody>
            </Table>
            </TableContainer> */}
      </>
    )
  }
}

TradeTeamSummary.propTypes = {
  analysis: PropTypes.object
}
