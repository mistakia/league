import React from 'react'

import { Roster } from '@common'
import TeamName from '@components/team-name'
import PageLayout from '@layouts/page'
import TradePlayer from '@components/trade-player'
import TradePick from '@components/trade-pick'
import Button from '@components/button'
import TradeMenu from '@components/trade-menu'

import './trade.styl'

export default function () {
  const {
    valid,
    trade,
    sendRoster,
    receiveRoster,
    sendTeam,
    receiveTeam,
    isProposer,
    dropPlayers
  } = this.props

  const sPlayerItems = []
  const sPickItems = []
  const rPlayerItems = []
  const rPickItems = []
  const isOpen = !trade.cancelled && !trade.rejected && !trade.accepted && !trade.vetoed

  if (!trade.uid) {
    const sRoster = new Roster(sendRoster.toJS())
    for (const [index, player] of sRoster.players.entries()) {
      if (player) {
        sPlayerItems.push(
          <TradePlayer
            key={`player${index}`}
            handleClick={() => this.handleSendPlayerClick(player)}
            isSelected={trade.sendPlayers.includes(player)}
            playerId={player}
          />
        )
      }
    }
    for (const pick of sendTeam.picks) {
      sPickItems.push(
        <TradePick
          key={pick.uid}
          handleClick={() => this.handleSendPickClick(pick)}
          isSelected={trade.sendPicks.has(pick.uid)}
          pick={pick}
        />
      )
    }

    const rRoster = new Roster(receiveRoster.toJS())
    for (const [index, player] of rRoster.players.entries()) {
      if (player) {
        rPlayerItems.push(
          <TradePlayer
            key={`player${index}`}
            handleClick={() => this.handleReceivePlayerClick(player)}
            isSelected={trade.receivePlayers.includes(player)}
            playerId={player}
          />
        )
      }
    }
    for (const pick of receiveTeam.picks) {
      rPickItems.push(
        <TradePick
          key={pick.uid}
          handleClick={() => this.handleReceivePickClick(pick)}
          isSelected={trade.receivePicks.has(pick.uid)}
          pick={pick}
        />
      )
    }
  }

  const sItems = []
  for (const [index, player] of trade.sendPlayers.entries()) {
    sItems.push(
      <TradePlayer
        key={index}
        handleClick={() => !trade.uid && this.handleSendPlayerClick(player)}
        playerId={player}
      />
    )
  }
  for (const [key, pick] of trade.sendPicks.entries()) {
    sItems.push(
      <TradePick
        key={key}
        handleClick={() => !trade.uid && this.handleSendPickClick(pick)}
        pick={pick}
      />
    )
  }

  const rItems = []
  for (const [index, player] of trade.receivePlayers.entries()) {
    rItems.push(
      <TradePlayer
        key={index}
        handleClick={() => !trade.uid && this.handleReceivePlayerClick(player)}
        playerId={player}
      />
    )
  }
  for (const [key, pick] of trade.receivePicks.entries()) {
    rItems.push(
      <TradePick
        key={key}
        handleClick={() => !trade.uid && this.handleReceivePickClick(pick)}
        pick={pick}
      />
    )
  }

  const tradeHead = (
    <div className='trade__head'>
      <div className='trade__box'>
        <div className='trade__box-head'>
          <TeamName tid={sendRoster.tid} />
        </div>
        <div className='trade__box-body'>
          {sPlayerItems}
          {sPickItems}
        </div>
      </div>
      <div className='trade__box'>
        <div className='trade__box-head'>
          <TeamName tid={receiveRoster.tid} />
        </div>
        <div className='trade__box-body'>
          {rPlayerItems}
          {rPickItems}
        </div>
      </div>
    </div>
  )

  let action
  if (trade.cancelled) {
    action = (<Button disabled>Cancelled</Button>)
  } else if (trade.rejected) {
    action = (<Button disabled>Rejected</Button>)
  } else if (trade.accepted) {
    action = (<Button disabled>Accepted</Button>)
  } else if (trade.vetoed) {
    action = (<Button disabled>Vetoed</Button>)
  } else if (!valid) {
    action = (<Button disabled>Invalid</Button>)
  } else if (!trade.uid) {
    action = (<Button onClick={this.handleProposeClick}>Propose</Button>)
  } else {
    if (isProposer) {
      action = (<Button onClick={this.handleCancelClick}>Cancel Proposal</Button>)
    } else {
      action = (<Button onClick={this.handleAcceptClick}>Accept Proposal</Button>)
    }
  }

  const invalidNotice = (
    <div className='trade__invalid'>
      Trade can not be processed, you must select players to drop.
    </div>
  )

  const dropItems = []
  if (isOpen && (!valid || dropPlayers.size)) {
    const sRoster = new Roster(sendRoster.toJS())
    for (const [index, player] of sRoster.players.entries()) {
      const sPlayers = isProposer ? trade.sendPlayers : trade.receivePlayers
      if (player && !sPlayers.includes(player)) {
        dropItems.push(
          <TradePlayer
            key={`player${index}`}
            handleClick={() => this.handleDropPlayerClick(player)}
            isSelected={dropPlayers.includes(player)}
            playerId={player}
          />
        )
      }
    }
  } else if (trade.uid && isProposer && trade.dropPlayers) {
    for (const [index, player] of trade.dropPlayers.entries()) {
      dropItems.push(
        <TradePlayer
          key={index}
          playerId={player}
        />
      )
    }
  }

  const body = (
    <div className='trade'>
      <TradeMenu />
      <div className='trade__main'>
        {!trade.uid && tradeHead}
        <div className='trade__body'>
          <div className='trade__summary'>
            <div className='trade__box'>
              {!!sItems.length &&
                <div className='trade__box-head'>
                  <TeamName tid={trade.pid || sendRoster.tid} />
                  <div className='trade__offer'>Sends</div>
                </div>}
              {sItems}
            </div>
            <div className='trade__box'>
              {!!rItems.length &&
                <div className='trade__box-head'>
                  <TeamName tid={trade.tid || receiveRoster.tid} />
                  <div className='trade__offer'>Sends</div>
                </div>}
              {rItems}
            </div>
          </div>
          {!!dropItems.length &&
            <div className='trade__drop'>
              <div className='trade__box'>
                <div className='trade__box-head'>
                  <TeamName tid={sendRoster.tid} />
                  <div className='trade__offer'>Drop</div>
                </div>
                <div className='traade__box-body'>
                  {dropItems}
                </div>
              </div>
            </div>}
          <div className='trade__action'>
            {action}
            {(isOpen && !valid) && invalidNotice}
          </div>
        </div>
      </div>
      <div className='trade__side' />
    </div>
  )

  return (
    <PageLayout body={body} scroll />
  )
}
