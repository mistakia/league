import React from 'react'
import Alert from '@material-ui/lab/Alert'
import AlertTitle from '@material-ui/lab/AlertTitle'
import List from '@material-ui/core/List'
import ListItem from '@material-ui/core/ListItem'
import Grid from '@material-ui/core/Grid'

import TeamName from '@components/team-name'
import PageLayout from '@layouts/page'
import TradePlayer from '@components/trade-player'
import TradePick from '@components/trade-pick'
import TradeMenu from '@components/trade-menu'
import TradeSelectTeam from '@components/trade-select-team'
import TradeAction from '@components/trade-action'
import TradeSelectItems from '@components/trade-select-items'
import TradeTeamSummary from '@components/trade-team-summary'

import './trade.styl'

export default function () {
  const {
    isValid,
    trade,
    tradePlayers,

    proposingTeam,
    proposingTeamRoster,
    proposingTeamPlayers,

    acceptingTeam,
    acceptingTeamPlayers,

    isProposer,
    analysis
  } = this.props

  const isOpen = !trade.cancelled && !trade.rejected && !trade.accepted && !trade.vetoed

  const sItems = []
  trade.proposingTeamPlayers.forEach(p => sItems.push(
    <TradePlayer key={p} playerId={p} />
  ))
  trade.proposingTeamPicks.forEach(p => sItems.push(
    <TradePick key={p} pick={p} />
  ))

  const rItems = []
  trade.acceptingTeamPlayers.forEach(p => rItems.push(
    <TradePlayer key={p} playerId={p} />
  ))
  trade.acceptingTeamPicks.forEach(p => rItems.push(
    <TradePick key={p} pick={p} />
  ))

  const invalidNotice = (
    <Alert severity='warning'>
      <AlertTitle>Exceeds Roster Limits</AlertTitle>
      You must select player(s) to drop
    </Alert>
  )

  const action = (
    <Grid item xs={12}>
      <div className='trade__action'>
        {isValid && <TradeAction />}
        {(isOpen && !isValid) && invalidNotice}
      </div>
    </Grid>
  )

  const proposingTeamDropPlayers = []
  for (const [index, player] of trade.proposingTeamDropPlayers.entries()) {
    proposingTeamDropPlayers.push(
      <TradePlayer
        key={index}
        playerId={player}
      />
    )
  }

  const acceptingTeamDropPlayers = []
  for (const [index, player] of trade.acceptingTeamDropPlayers.entries()) {
    acceptingTeamDropPlayers.push(
      <TradePlayer
        key={index}
        playerId={player}
      />
    )
  }

  const teamDropPlayers = isProposer
    ? proposingTeamPlayers.filter(p => !trade.proposingTeamPlayers.includes(p.player))
    : acceptingTeamPlayers.filter(p => !trade.acceptingTeamPlayers.includes(p.player))

  const showProposingTeamDropSection = Boolean((isProposer && !isValid) ||
    trade.proposingTeamDropPlayers.size)
  const proposingTeamDropSection = (
    <div className='trade__box'>
      <div className='trade__box-body'>
        <TradeSelectItems
          title='Select players to drop'
          disabled={Boolean(trade.uid)}
          onChange={this.handleDropChange}
          selectedPlayers={tradePlayers.proposingTeamDropPlayers.toJS()}
          players={teamDropPlayers}
        />
        {proposingTeamDropPlayers}
      </div>
    </div>
  )

  const showAcceptingTeamDropSection = Boolean((!isProposer && !isValid) ||
    trade.acceptingTeamDropPlayers.size)
  const acceptingTeamDropSection = (
    <div className='trade__box'>
      <div className='trade__box-body'>
        <TradeSelectItems
          title='Select players to drop'
          disabled={!isOpen}
          onChange={this.handleDropChange}
          selectedPlayers={tradePlayers.acceptingTeamDropPlayers.toJS()}
          players={teamDropPlayers}
        />
        {acceptingTeamDropPlayers}
      </div>
    </div>
  )

  const body = (
    <div className='trade'>
      <TradeMenu />
      <div className='trade__main'>
        <Grid container>
          <Grid container item xs={12}>
            <Grid item xs={12} md={6} classes={{ root: 'trade__team-summary' }}>
              <TradeTeamSummary analysis={analysis.proposingTeam} />
            </Grid>
            <Grid item xs={12} md={6} classes={{ root: 'trade__team-summary' }}>
              <TradeTeamSummary analysis={analysis.acceptingTeam} />
            </Grid>
          </Grid>
          <Grid item xs={12} md={6}>
            <div className='trade__box'>
              <div className='trade__box-head'>
                <List component='nav'>
                  <ListItem>
                    <TeamName tid={trade.pid || proposingTeamRoster.tid} />
                  </ListItem>
                </List>
              </div>
              <div className='trade__box-body'>
                <TradeSelectItems
                  disabled={Boolean(trade.uid)}
                  onChange={this.handleProposeChange}
                  selectedPlayers={tradePlayers.proposingTeamPlayers.toJS()}
                  selectedPicks={trade.proposingTeamPicks.toJS()}
                  picks={proposingTeam.picks}
                  players={proposingTeamPlayers}
                />
                {sItems}
              </div>
            </div>
            {showProposingTeamDropSection && proposingTeamDropSection}
          </Grid>
          <Grid item xs={12} md={6}>
            <div className='trade__box'>
              <div className='trade__box-head'>
                <TradeSelectTeam />
              </div>
              <div className='trade__box-body'>
                <TradeSelectItems
                  disabled={Boolean(trade.uid)}
                  onChange={this.handleAcceptChange}
                  selectedPlayers={tradePlayers.acceptingTeamPlayers.toJS()}
                  selectedPicks={trade.acceptingTeamPicks.toJS()}
                  players={acceptingTeamPlayers}
                  picks={acceptingTeam.picks}
                />
                {rItems}
              </div>
            </div>
            {showAcceptingTeamDropSection && acceptingTeamDropSection}
          </Grid>
          {action}
        </Grid>
      </div>
      <div className='trade__side' />
    </div>
  )

  return (
    <PageLayout body={body} scroll />
  )
}
