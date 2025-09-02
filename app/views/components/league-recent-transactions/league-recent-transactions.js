import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'

import { timeago } from '@core/utils'
import PlayerName from '@components/player-name'
import TeamName from '@components/team-name'

import './league-recent-transactions.styl'

function LeagueRecentTransaction({ transaction }) {
  return (
    <div className='league__recent-transaction transaction--wide'>
      <div className='transaction__team'>
        <TeamName abbrv color image tid={transaction.tid} />
      </div>
      <PlayerName headshot_width={48} headshot_square pid={transaction.pid} />
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
    <div className='league__recent-transactions'>
      <div className='transactions__section'>
        <div className='transactions__section-title'>Signings</div>
        <div className='transactions__section-body empty'>{signing_items}</div>
      </div>
      <div className='transactions__section'>
        <div className='transactions__section-title'>Releases</div>
        <div className='transactions__section-body empty'>{release_items}</div>
      </div>
    </div>
  )
}

LeagueRecentTransactions.propTypes = {
  signings: ImmutablePropTypes.list,
  releases: ImmutablePropTypes.list
}
