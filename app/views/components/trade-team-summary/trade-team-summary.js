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
  const is_positive = delta >= 0
  const sign = is_positive ? '+' : '-'
  const delta_pct = ((delta / analysis.before[type]) * 100 || 0).toFixed(1)
  const class_names = ['trade__percentage']
  if (is_positive) {
    class_names.push('positive')
  } else {
    class_names.push('negative')

    if (delta_pct > -1.5) {
      class_names.push('warning')
    }
  }

  return (
    <div className={class_names.join(' ')}>
      {`${sign}${Math.abs(delta_pct)}%`}
    </div>
  )
}

export default class TradeTeamSummary extends React.Component {
  render = () => {
    const { analysis } = this.props

    const pct_points = Percentage('points', analysis)
    const pct_value = Percentage('value', analysis)
    const pct_value_adj = Percentage('value_adj', analysis)
    const pct_draft_value = Percentage('draft_value', analysis)
    const pct_player_value = Percentage('player_value', analysis)

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
                <TableCell>{pct_points}</TableCell>
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
                <TableCell>{pct_value}</TableCell>
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
                <TableCell>{pct_player_value}</TableCell>
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
                <TableCell>{pct_value_adj}</TableCell>
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
                <TableCell>{pct_draft_value}</TableCell>
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
