import React from 'react'
import Table from '@material-ui/core/Table'
import TableBody from '@material-ui/core/TableBody'
import TableCell from '@material-ui/core/TableCell'
import TableContainer from '@material-ui/core/TableContainer'
import TableHead from '@material-ui/core/TableHead'
import TableRow from '@material-ui/core/TableRow'
import Paper from '@material-ui/core/Paper'

function getPct(type, analysis) {
  const delta = analysis.after[type] - analysis.before[type]
  return ((delta / analysis.before[type]) * 100 || 0).toFixed(1)
}

export default class TradeTeamSummary extends React.Component {
  render = () => {
    const { analysis } = this.props

    const pctPoints = getPct('points', analysis)
    const pctValue = getPct('value', analysis)
    const pctValueAdj = getPct('value_adj', analysis)
    const pctSalary = getPct('salary', analysis)

    return (
      <TableContainer component={Paper}>
        <Table size='small'>
          <TableHead>
            <TableRow>
              <TableCell align='center' colSpan={2}>
                Team Summary
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell component='th' scope='row'>
                Points
              </TableCell>
              <TableCell align='right'>
                {analysis.after.points} ({pctPoints}%)
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell component='th' scope='row'>
                Value
              </TableCell>
              <TableCell align='right'>
                {(analysis.after.value || 0).toFixed(1)} ({pctValue}%)
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell component='th' scope='row'>
                Salary Adjusted Value
              </TableCell>
              <TableCell align='right'>
                {(analysis.after.value_adj || 0).toFixed(1)} ({pctValueAdj}%)
              </TableCell>
            </TableRow>
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
                Team Salary
              </TableCell>
              <TableCell align='right'>
                {analysis.after.salary || 0} ({pctSalary}%)
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell component='th' scope='row'>
                Roster Space
              </TableCell>
              <TableCell align='right' />
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    )
  }
}
