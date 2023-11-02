import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import Grid from '@mui/material/Grid'

import { timeago } from '@core/utils'
import PlayerName from '@components/player-name'
import TeamName from '@components/team-name'

import './league-recent-transactions.styl'

function LeagueRecentTransaction({ transaction }) {
  return (
    <div className='league__recent-transaction'>
      <div className='transaction__team'>
        <TeamName abbrv color image tid={transaction.tid} />
      </div>
      <PlayerName headshot_width={48} pid={transaction.pid} />
      <div className='transaction__timestamp'>
        {timeago.format(transaction.timestamp * 1000, 'league_short')}
      </div>
    </div>
  )
}

LeagueRecentTransaction.propTypes = {
  transaction: PropTypes.object
}

export default function LeagueRecentTransactions({ signings, releases }) {
  const signing_items = []
  const release_items = []

  signings.slice(0, 10).forEach((transaction, index) => {
    signing_items.push(
      <LeagueRecentTransaction transaction={transaction} key={index} />
    )
  })

  releases.slice(0, 10).forEach((transaction, index) => {
    release_items.push(
      <LeagueRecentTransaction transaction={transaction} key={index} />
    )
  })

  return (
    <Grid
      container
      item
      xs={12}
      spacing={2}
      className='league__recent-transactions'
    >
      <Grid container item xs={12} md={6} className='transactions__section'>
        <div className='transactions__section-title'>Signings</div>
        <div className='transactions__section-body empty'>{signing_items}</div>
      </Grid>
      <Grid container item xs={12} md={6} className='transactions__section'>
        <div className='transactions__section-title'>Releases</div>
        <div className='transactions__section-body empty'>{release_items}</div>
      </Grid>
    </Grid>
  )
}

LeagueRecentTransactions.propTypes = {
  signings: ImmutablePropTypes.list,
  releases: ImmutablePropTypes.list
}
