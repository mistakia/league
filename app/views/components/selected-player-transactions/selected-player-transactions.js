import React, { useEffect } from 'react'
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

import { constants } from '@libs-shared'
import TeamName from '@components/team-name'
import Timestamp from '@components/timestamp'
import TransactionRow from '@components/transaction-row'

import './selected-player-transactions.styl'

export default function SelectedPlayerTransactions({
  player_map,
  teams,
  maxTransaction,
  load,
  draft_transaction,
  extension_salaries,
  extensions,
  value,
  loadingTransactions
}) {
  useEffect(() => {
    load({ pid: player_map.get('pid') })
  }, [load, player_map])

  const transactions = player_map.get('transactions', new List())

  if (loadingTransactions && !transactions.size) {
    return <LinearProgress />
  }

  if (!transactions.size) {
    return (
      <div className='selected__player-transactions-body'>
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
        layout='narrow'
      />
    )
  }

  const team_rows = []
  for (const transaction of Object.values(teams)) {
    team_rows.push(
      <TableRow
        key={transaction.uid}
        sx={{ '&:hover': { backgroundColor: '#fafafa' } }}
      >
        <TableCell
          sx={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0' }}
        >
          <TeamName tid={transaction.tid} key={transaction.tid} abbrv />
        </TableCell>
        <TableCell
          sx={{
            padding: '12px 16px',
            borderBottom: '1px solid #f0f0f0',
            fontWeight: 600
          }}
        >
          ${transaction.value}
        </TableCell>
        <TableCell
          sx={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0' }}
        >
          <span style={{ fontWeight: '500', color: '#444' }}>
            {constants.transactionsDetail[transaction.type]}
          </span>
        </TableCell>
        <TableCell
          sx={{
            padding: '12px 16px',
            borderBottom: '1px solid #f0f0f0',
            color: '#666'
          }}
        >
          <Timestamp timestamp={transaction.timestamp} />
        </TableCell>
      </TableRow>
    )
  }

  return (
    <div className='selected__player-transactions-body'>
      <div className='selected__player-transactions-all'>{items}</div>
      <div className='selected__player-transactions-summary'>
        {player_map.get('tid') && (
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
        )}
        {draft_transaction && (
          <TableContainer>
            <Table size='small'>
              <TableBody>
                <TableRow>
                  <TableCell variant='head'>Drafted By</TableCell>
                  <TableCell colSpan={2}>
                    <TeamName tid={draft_transaction.tid} abbrv />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell variant='head'>Draft Year</TableCell>
                  <TableCell colSpan={2}>{draft_transaction.year}</TableCell>
                </TableRow>
                {draft_transaction.pick && (
                  <TableRow>
                    <TableCell variant='head'>Draft Pick</TableCell>
                    <TableCell colSpan={2}>
                      #{draft_transaction.pick}
                      {draft_transaction.pick_str &&
                        ` (${draft_transaction.pick_str})`}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
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
            <TableBody>{team_rows}</TableBody>
          </Table>
        </TableContainer>
      </div>
    </div>
  )
}

SelectedPlayerTransactions.propTypes = {
  player_map: ImmutablePropTypes.map,
  teams: PropTypes.object,
  maxTransaction: PropTypes.object,
  load: PropTypes.func,
  draft_transaction: PropTypes.object,
  extension_salaries: PropTypes.array,
  extensions: PropTypes.number,
  value: PropTypes.number,
  loadingTransactions: PropTypes.bool
}
