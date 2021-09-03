import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import Table from '@material-ui/core/Table'
import TableBody from '@material-ui/core/TableBody'
import TableCell from '@material-ui/core/TableCell'
import TableContainer from '@material-ui/core/TableContainer'
import TableHead from '@material-ui/core/TableHead'
import TableRow from '@material-ui/core/TableRow'
import LinearProgress from '@material-ui/core/LinearProgress'

import { constants } from '@common'
import TeamName from '@components/team-name'
import Timestamp from '@components/timestamp'
import TransactionRow from '@components/transaction-row'

import './selected-player-transactions.styl'

export default class SelectedPlayerTransactions extends React.Component {
  componentDidMount() {
    this.props.load(this.props.player.player)
  }

  render = () => {
    const { teams, maxTransaction } = this.props
    const { transactions, loadingTransactions } = this.props.player
    if (loadingTransactions && !transactions.size) {
      return <LinearProgress color='secondary' />
    }

    if (!transactions.size) {
      return (
        <div className='selected__player-transactions'>
          No transaction history
        </div>
      )
    }

    const items = []
    for (const transaction of transactions.valueSeq()) {
      items.push(
        <TransactionRow
          transaction={transaction}
          key={transaction.uid}
          style={{ height: 40 }}
        />
      )
    }

    const teamRows = []
    for (const transaction of Object.values(teams)) {
      teamRows.push(
        <TableRow key={transaction.uid}>
          <TableCell>
            <TeamName tid={transaction.tid} key={transaction.tid} />
          </TableCell>
          <TableCell>${transaction.value}</TableCell>
          <TableCell>
            {constants.transactionsDetail[transaction.type]}
          </TableCell>
          <TableCell>
            <Timestamp timestamp={transaction.timestamp} />
          </TableCell>
        </TableRow>
      )
    }

    return (
      <div className='selected__player-transactions'>
        <div className='selected__player-transactions-all'>{items}</div>
        <div className='selected__player-transactions-summary'>
          <TableContainer>
            <Table size='small'>
              <TableBody>
                <TableRow>
                  <TableCell>Total Teams</TableCell>
                  <TableCell colSpan={2}>{Object.keys(teams).length}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Max Salary</TableCell>
                  <TableCell>${maxTransaction.value}</TableCell>
                  <TableCell>
                    <Timestamp timestamp={maxTransaction.timestamp} />
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
          <TableContainer>
            <Table size='small'>
              <TableHead>
                <TableRow>
                  <TableCell>Team</TableCell>
                  <TableCell>Max</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Date</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>{teamRows}</TableBody>
            </Table>
          </TableContainer>
        </div>
      </div>
    )
  }
}

SelectedPlayerTransactions.propTypes = {
  player: ImmutablePropTypes.record,
  teams: PropTypes.object,
  maxTransaction: PropTypes.object,
  load: PropTypes.func
}
