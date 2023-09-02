import React from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'

import TeamName from '@components/team-name'

import './auction-team.styl'

export default class AuctionTeam extends React.Component {
  render = () => {
    const {
      team,
      isConnected,
      isWinningBid,
      bid,
      isNominating,
      roster,
      isOwner
    } = this.props

    const classNames = ['auction__team']
    if (!isConnected) {
      classNames.push('offline')
    }

    if (isNominating) {
      classNames.push('nominating')
    }

    if (isWinningBid) {
      classNames.push('winning')
    }

    if (isOwner) {
      classNames.push('owner')
    }

    const hasBid = bid !== null

    return (
      <div className={classNames.join(' ')}>
        <div className='auction__team-name'>
          <TeamName abbrv color tid={team.uid} />
        </div>
        <div className='auction__team-cap'>${roster.availableCap}</div>
        <div className='auction__team-roster-space'>
          {roster.availableSpace}
        </div>
        {hasBid && <div className='auction__team-bid'>$ {bid}</div>}
      </div>
    )
  }
}

AuctionTeam.propTypes = {
  team: ImmutablePropTypes.record,
  isConnected: PropTypes.bool,
  isWinningBid: PropTypes.bool,
  bid: PropTypes.number,
  isNominating: PropTypes.bool,
  roster: PropTypes.object,
  isOwner: PropTypes.bool
}
