import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'

import TeamName from '@components/team-name'

import './trade-menu.styl'

export default class TradeMenu extends React.Component {
  render = () => {
    const { trades, selectedTradeId, select, teamId } = this.props

    const menuItems = []
    for (const [index, trade] of trades.entries()) {
      const classNames = ['trade__menu-item']
      if (selectedTradeId === trade.uid) classNames.push('selected')
      const otherTeamId =
        teamId === trade.propose_tid ? trade.accept_tid : trade.propose_tid
      menuItems.push(
        <div
          key={index}
          className={classNames.join(' ')}
          onClick={() => select(trade.uid)}
        >
          <div className='trade__id'>#{trade.uid}</div>
          <TeamName tid={otherTeamId} abbrv />
        </div>
      )
    }

    return (
      <div className='trade__menu'>
        <div className='trade__menu-head'>Offers</div>
        <div className='trade__menu-body empty'>
          {selectedTradeId && (
            <div onClick={() => select()} className='trade__menu-item'>
              New Trade Offer
            </div>
          )}
          {menuItems}
        </div>
      </div>
    )
  }
}

TradeMenu.propTypes = {
  trades: ImmutablePropTypes.map,
  selectedTradeId: PropTypes.number,
  select: PropTypes.func,
  teamId: PropTypes.number
}
