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
  const before = analysis.before[type]
  const after = analysis.after[type]

  // Only a non-finite before/after makes a percentage undefined. Zero is a real
  // value, so guard on finiteness rather than truthiness -- the old truthy
  // check rendered '-' for any team whose before or after total was legitimately 0.
  if (!Number.isFinite(before) || !Number.isFinite(after)) return '-'
  if (before === 0) return '-'

  const delta = after - before
  const is_positive = delta >= 0
  const sign = is_positive ? '+' : '-'
  const delta_pct = (delta / before) * 100
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
      {`${sign}${Math.abs(delta_pct).toFixed(1)}%`}
    </div>
  )
}

// A legitimately-zero metric must render as 0, not '-'. Only a missing or
// non-numeric value is unknown.
function Metric(value, decimals = 1) {
  if (!Number.isFinite(value)) return '-'
  return value.toFixed(decimals)
}

function SignedDelta(after, before) {
  if (!Number.isFinite(after) || !Number.isFinite(before)) return '-'
  const delta = after - before
  const class_names = ['trade__percentage', 'metric']
  class_names.push(delta >= 0 ? 'positive' : 'negative')
  return (
    <div className={class_names.join(' ')}>
      {`${delta >= 0 ? '+' : '-'}${Math.abs(delta)}`}
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
                    {Metric(analysis.after.points, 0)}
                  </div>
                </TableCell>
                <TableCell>{pct_points}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell component='th' scope='row'>
                  Overall Value
                </TableCell>
                <TableCell align='right'>
                  <div className='metric'>{Metric(analysis.after.value)}</div>
                </TableCell>
                <TableCell>{pct_value}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell component='th' scope='row'>
                  Player Value
                </TableCell>
                <TableCell align='right'>
                  <div className='metric'>
                    {Metric(analysis.after.player_value)}
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
                    {Metric(analysis.after.value_adj)}
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
                    {Metric(analysis.after.draft_value)}
                  </div>
                </TableCell>
                <TableCell>{pct_draft_value}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell component='th' scope='row'>
                  Team Salary
                </TableCell>
                <TableCell align='right'>
                  <div className='metric'>
                    {Metric(analysis.after.salary, 0)}
                  </div>
                </TableCell>
                <TableCell>
                  {SignedDelta(analysis.after.salary, analysis.before.salary)}
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
