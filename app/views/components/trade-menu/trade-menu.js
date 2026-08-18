import React from 'react'
import ImmutablePropTypes from 'react-immutable-proptypes'
import PropTypes from 'prop-types'

import TeamName from '@components/team-name'
import TradeVetoCountdown from '@components/trade-veto-countdown'
import { is_trade_within_veto_window } from '#libs-shared'
import { useClockSeconds } from '@core/utils'

import './trade-menu.styl'

/**
 * The commissioner's veto queue. A commissioner is usually not party to the
 * trades they have to rule on, so these are league-wide and listed apart from
 * the user's own offers — and each drops off as its window closes, which is why
 * this ticks its own clock instead of waiting on a state change.
 */
function VetoableTrades({ trades, league, selectedTradeId, select }) {
  const now = useClockSeconds()

  const open = trades.filter((trade) =>
    is_trade_within_veto_window({ trade, league, now })
  )

  if (!open.size) {
    return null
  }

  return (
    <>
      <div className='trade__menu-head'>Vetoable</div>
      <div className='trade__menu-body'>
        {open.toArray().map((trade) => {
          const class_names = ['trade__menu-item']
          if (selectedTradeId === trade.trade_id) class_names.push('selected')
          return (
            <div
              key={trade.trade_id}
              className={class_names.join(' ')}
              onClick={() => select(trade.trade_id)}
            >
              <div className='trade__id'>#{trade.trade_id}</div>
              <TeamName tid={trade.propose_tid} abbrv />
              <TeamName tid={trade.accept_tid} abbrv />
              <TradeVetoCountdown trade={trade} league={league} prefix='' />
            </div>
          )
        })}
      </div>
    </>
  )
}

VetoableTrades.propTypes = {
  trades: ImmutablePropTypes.list,
  league: PropTypes.object,
  selectedTradeId: PropTypes.number,
  select: PropTypes.func
}

export default class TradeMenu extends React.Component {
  render = () => {
    const {
      trades,
      selectedTradeId,
      select,
      teamId,
      league,
      is_commish,
      veto_candidate_trades
    } = this.props

    // A commissioner's trade state also carries the league's vetoable trades,
    // which belong in the section above rather than among the user's offers.
    const own_trades = trades.filter(
      (trade) => trade.propose_tid === teamId || trade.accept_tid === teamId
    )

    const menuItems = []
    for (const [index, trade] of own_trades.entries()) {
      const classNames = ['trade__menu-item']
      if (selectedTradeId === trade.trade_id) classNames.push('selected')
      const otherTeamId =
        teamId === trade.propose_tid ? trade.accept_tid : trade.propose_tid
      menuItems.push(
        <div
          key={index}
          className={classNames.join(' ')}
          onClick={() => select(trade.trade_id)}
        >
          <div className='trade__id'>#{trade.trade_id}</div>
          <TeamName tid={otherTeamId} abbrv />
        </div>
      )
    }

    return (
      <div className='trade__menu'>
        {is_commish && (
          <VetoableTrades
            trades={veto_candidate_trades}
            league={league}
            selectedTradeId={selectedTradeId}
            select={select}
          />
        )}
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
  veto_candidate_trades: ImmutablePropTypes.list,
  selectedTradeId: PropTypes.number,
  select: PropTypes.func,
  teamId: PropTypes.number,
  league: PropTypes.object,
  is_commish: PropTypes.bool
}
