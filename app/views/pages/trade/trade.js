import React from 'react'

import { Roster } from '@common'
import TeamName from '@components/team-name'
import PageLayout from '@layouts/page'
import TradePlayer from '@components/trade-player'
import TradePick from '@components/trade-pick'
import Button from '@components/button'
import TradeMenu from '@components/trade-menu'
import TradeSelectTeam from '@components/trade-select-team'

import './trade.styl'

export default function () {
  const {
    valid,
    trade,
    proposingTeamRoster,
    acceptingTeamRoster,
    proposingTeam,
    acceptingTeam,
    isProposer,
    dropPlayers,
    league
  } = this.props

  const sPlayerItems = []
  const sPickItems = []
  const rPlayerItems = []
  const rPickItems = []
  const isOpen = !trade.cancelled && !trade.rejected && !trade.accepted && !trade.vetoed

  if (!trade.uid) {
    const sRoster = new Roster({ roster: proposingTeamRoster.toJS(), league })
    for (const [index, item] of sRoster.players.entries()) {
      const { player } = item
      sPlayerItems.push(
        <TradePlayer
          key={`player${index}`}
          handleClick={() => this.handleProposingTeamPlayerClick(player)}
          isSelected={trade.proposingTeamPlayers.includes(player)}
          playerId={player}
        />
      )
    }
    for (const pick of proposingTeam.picks) {
      if (pick.player) continue
      sPickItems.push(
        <TradePick
          key={pick.uid}
          handleClick={() => this.handleProposingTeamPickClick(pick)}
          isSelected={trade.proposingTeamPicks.has(pick.uid)}
          pick={pick}
        />
      )
    }

    const rRoster = new Roster({ roster: acceptingTeamRoster.toJS(), league })
    for (const [index, item] of rRoster.players.entries()) {
      const { player } = item
      rPlayerItems.push(
        <TradePlayer
          key={`player${index}`}
          handleClick={() => this.handleAcceptingTeamPlayerClick(player)}
          isSelected={trade.acceptingTeamPlayers.includes(player)}
          playerId={player}
        />
      )
    }
    for (const pick of acceptingTeam.picks) {
      if (pick.player) continue
      rPickItems.push(
        <TradePick
          key={pick.uid}
          handleClick={() => this.handleAcceptingTeamPickClick(pick)}
          isSelected={trade.acceptingTeamPicks.has(pick.uid)}
          pick={pick}
        />
      )
    }
  }

  const sItems = []
  for (const [index, player] of trade.proposingTeamPlayers.entries()) {
    sItems.push(
      <TradePlayer
        key={index}
        handleClick={() => !trade.uid && this.handleProposingTeamPlayerClick(player)}
        playerId={player}
      />
    )
  }
  for (const [key, pick] of trade.proposingTeamPicks.entries()) {
    sItems.push(
      <TradePick
        key={key}
        handleClick={() => !trade.uid && this.handleProposingTeamPickClick(pick)}
        pick={pick}
      />
    )
  }

  const rItems = []
  for (const [index, player] of trade.acceptingTeamPlayers.entries()) {
    rItems.push(
      <TradePlayer
        key={index}
        handleClick={() => !trade.uid && this.handleAcceptingTeamPlayerClick(player)}
        playerId={player}
      />
    )
  }
  for (const [key, pick] of trade.acceptingTeamPicks.entries()) {
    rItems.push(
      <TradePick
        key={key}
        handleClick={() => !trade.uid && this.handleAcceptingTeamPickClick(pick)}
        pick={pick}
      />
    )
  }

  const tradeHead = (
    <div className='trade__head'>
      <div className='trade__box'>
        <div className='trade__box-head'>
          <TeamName tid={proposingTeamRoster.tid} />
        </div>
        <div className='trade__box-body'>
          {sPlayerItems}
          {sPickItems}
        </div>
      </div>
      <div className='trade__box'>
        <div className='trade__box-head'>
          <TeamName tid={acceptingTeamRoster.tid} />
          {!trade.uid && <TradeSelectTeam />}
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
    if ((trade.proposingTeamPlayers.size || trade.proposingTeamPicks.size) && (trade.acceptingTeamPlayers.size || trade.acceptingTeamPicks.size)) {
      action = (<Button onClick={this.handleProposeClick}>Propose</Button>)
    } else {
      action = (<Button disabled>Propose</Button>)
    }
  } else {
    if (isProposer) {
      action = (<Button onClick={this.handleCancelClick}>Cancel Offer</Button>)
    } else {
      action = (
        <div>
          <Button onClick={this.handleAcceptClick}>Accept Offer</Button>
          <Button onClick={this.handleRejectClick}>Reject Offer</Button>
        </div>
      )
    }
  }

  const invalidNotice = (
    <div className='trade__invalid'>
      Trade can not be processed, you must select players to drop.
    </div>
  )

  const dropItems = []
  if (isOpen && (!valid || dropPlayers.size)) {
    const sRoster = new Roster({ roster: proposingTeamRoster.toJS(), league })
    for (const [index, item] of sRoster.players.entries()) {
      const { player } = item
      const sPlayers = isProposer ? trade.proposingTeamPlayers : trade.acceptingTeamPlayers
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
                  <TeamName tid={trade.pid || proposingTeamRoster.tid} />
                  <div className='trade__offer'>Sends</div>
                </div>}
              {sItems}
            </div>
            <div className='trade__box'>
              {!!rItems.length &&
                <div className='trade__box-head'>
                  <TeamName tid={trade.tid || acceptingTeamRoster.tid} />
                  <div className='trade__offer'>Sends</div>
                </div>}
              {rItems}
            </div>
          </div>
          {!!dropItems.length &&
            <div className='trade__drop'>
              <div className='trade__box'>
                <div className='trade__box-head'>
                  <TeamName tid={proposingTeamRoster.tid} />
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
