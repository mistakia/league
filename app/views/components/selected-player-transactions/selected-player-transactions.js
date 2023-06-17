import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import LinearProgress from '@mui/material/LinearProgress'
import { List } from 'immutable'

import { constants, getExtensionAmount } from '@libs-shared'
import TeamName from '@components/team-name'
import Timestamp from '@components/timestamp'
import TransactionRow from '@components/transaction-row'

import './selected-player-transactions.styl'

const getHeight = () => (window.innerWidth <= 600 ? 75 : 40)

export default class SelectedPlayerTransactions extends React.Component {
  constructor(props) {
    super(props)
    this.state = { height: getHeight() }
  }

  update = () => {
    this.setState({ height: getHeight() })
  }

  componentDidMount() {
    this.props.load(this.props.playerMap.get('pid'))
    window.addEventListener('resize', this.update)
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.update)
  }

  render = () => {
    const {
      teams,
      maxTransaction,
      playerMap,
      league,
      isBeforeExtensionDeadline
    } = this.props
    const transactions = playerMap.get('transactions', new List())
    const loadingTransactions = playerMap.get('loadingTransactions', false)

    if (loadingTransactions && !transactions.size) {
      return <LinearProgress />
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
          style={{ height: this.state.height }}
        />
      )
    }

    const teamRows = []
    for (const transaction of Object.values(teams)) {
      teamRows.push(
        <TableRow key={transaction.uid}>
          <TableCell>
            <TeamName tid={transaction.tid} key={transaction.tid} abbrv />
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

    const extensions = playerMap.get('extensions', 0)
    const value = playerMap.get('value')
    const extension_salaries = []
    const extended_salary = isBeforeExtensionDeadline
      ? getExtensionAmount({
          pos: playerMap.get('pos'),
          tag: playerMap.get('tag'),
          extensions,
          league,
          value
        })
      : value
    extension_salaries.push({
      year: constants.year,
      extended_salary
    })

    let salary = extended_salary
    let year = constants.year
    for (let i = extensions; extension_salaries.length < 4; i++) {
      salary = getExtensionAmount({
        pos: playerMap.get('pos'),
        extensions: i,
        league,
        value: salary
      })
      year += 1
      extension_salaries.push({
        year,
        extended_salary: salary
      })
    }

    return (
      <div className='selected__player-transactions'>
        <div className='selected__player-transactions-all'>{items}</div>
        <div className='selected__player-transactions-summary'>
          <TableContainer>
            <Table size='small'>
              <TableBody>
                <TableRow>
                  <TableCell variant='head'>Extension Count</TableCell>
                  <TableCell colSpan={2}>{extensions}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell variant='head'>Current Salary</TableCell>
                  <TableCell colSpan={2}>${value}</TableCell>
                </TableRow>
                {extension_salaries.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell variant='head'>{item.year} Salary</TableCell>
                    <TableCell colSpan={2}>${item.extended_salary}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TableContainer>
            <Table size='small'>
              <TableBody>
                <TableRow>
                  <TableCell variant='head'>Total Teams</TableCell>
                  <TableCell colSpan={2}>{Object.keys(teams).length}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell variant='head'>Max Salary</TableCell>
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
  playerMap: ImmutablePropTypes.map,
  teams: PropTypes.object,
  maxTransaction: PropTypes.object,
  load: PropTypes.func,
  league: PropTypes.object,
  isBeforeExtensionDeadline: PropTypes.bool
}
