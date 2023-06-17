import React from 'react'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import Grid from '@mui/material/Grid'

import { constants } from '@libs-shared'
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

export default function TradePage() {
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

  const isProposed = Boolean(trade.uid)
  const isOpen =
    !trade.cancelled && !trade.rejected && !trade.accepted && !trade.vetoed

  const sItems = []
  trade.proposingTeamPlayers.forEach((pid) =>
    sItems.push(<TradePlayer key={pid} pid={pid} />)
  )
  trade.proposingTeamPicks.forEach((p) =>
    sItems.push(<TradePick key={p.uid} pick={p} />)
  )

  const rItems = []
  trade.acceptingTeamPlayers.forEach((pid) =>
    rItems.push(<TradePlayer key={pid} pid={pid} />)
  )
  trade.acceptingTeamPicks.forEach((p) =>
    rItems.push(<TradePick key={p.uid} pick={p} />)
  )

  const invalidNotice = (
    <Alert severity='warning'>
      <AlertTitle>Exceeds Roster Limits</AlertTitle>
      You must select player(s) to release
    </Alert>
  )

  const action = (
    <Grid item xs={12}>
      <div className='trade__action'>
        {isValid && constants.week < constants.season.finalWeek && (
          <TradeAction />
        )}
        {isOpen && !isValid && invalidNotice}
      </div>
    </Grid>
  )

  const proposingTeamReleasePlayers = []
  trade.proposingTeamReleasePlayers.forEach((pid, index) => {
    proposingTeamReleasePlayers.push(<TradePlayer key={index} pid={pid} />)
  })

  const acceptingTeamReleasePlayers = []
  trade.acceptingTeamReleasePlayers.forEach((pid, index) => {
    acceptingTeamReleasePlayers.push(<TradePlayer key={index} pid={pid} />)
  })

  const teamReleasePlayers = isProposer
    ? proposingTeamPlayers.filter(
        (p) => !trade.proposingTeamPlayers.includes(p.pid)
      )
    : acceptingTeamPlayers.filter(
        (p) => !trade.acceptingTeamPlayers.includes(p.pid)
      )

  const showProposingTeamReleaseSection = Boolean(
    (isProposer && !isValid) || trade.proposingTeamReleasePlayers.size
  )
  const proposingTeamReleaseSection = (
    <div className='trade__box'>
      <div className='trade__box-head'>
        <List component='nav'>
          <ListItem>
            <TeamName tid={trade.propose_tid || proposingTeamRoster.tid} />{' '}
            Releases
          </ListItem>
        </List>
      </div>
      <div className='trade__box-body'>
        {!isProposed && (
          <TradeSelectItems
            title='Select players to release'
            onChange={this.handleReleaseChange}
            selectedPlayers={tradePlayers.proposingTeamReleasePlayers}
            players={teamReleasePlayers}
          />
        )}
        {proposingTeamReleasePlayers}
      </div>
    </div>
  )

  const showAcceptingTeamReleaseSection = Boolean(
    (!isProposer && !isValid) || trade.acceptingTeamReleasePlayers.size
  )
  const acceptingTeamReleaseSection = (
    <div className='trade__box'>
      <div className='trade__box-head'>
        <List component='nav'>
          <ListItem>
            <TeamName tid={trade.accept_tid || acceptingTeam.uid} /> Releases
          </ListItem>
        </List>
      </div>
      <div className='trade__box-body'>
        {isOpen && (
          <TradeSelectItems
            title='Select players to release'
            onChange={this.handleReleaseChange}
            selectedPlayers={tradePlayers.acceptingTeamReleasePlayers}
            players={teamReleasePlayers}
          />
        )}
        {acceptingTeamReleasePlayers}
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
                    <TeamName
                      tid={trade.propose_tid || proposingTeamRoster.tid}
                    />{' '}
                    Sends
                  </ListItem>
                </List>
              </div>
              <div className='trade__box-body'>
                {!isProposed && (
                  <TradeSelectItems
                    onChange={this.handleProposeChange}
                    selectedPlayers={tradePlayers.proposingTeamPlayers}
                    selectedPicks={trade.proposingTeamPicks.toJS()}
                    picks={proposingTeam.picks}
                    players={proposingTeamPlayers}
                  />
                )}
                {sItems}
              </div>
            </div>
            {showProposingTeamReleaseSection && proposingTeamReleaseSection}
          </Grid>
          <Grid item xs={12} md={6}>
            <div className='trade__box'>
              <div className='trade__box-head'>
                <TradeSelectTeam />
              </div>
              <div className='trade__box-body'>
                {!isProposed && (
                  <TradeSelectItems
                    onChange={this.handleAcceptChange}
                    selectedPlayers={tradePlayers.acceptingTeamPlayers}
                    selectedPicks={trade.acceptingTeamPicks.toJS()}
                    players={acceptingTeamPlayers}
                    picks={acceptingTeam.picks}
                  />
                )}
                {rItems}
              </div>
            </div>
            {showAcceptingTeamReleaseSection && acceptingTeamReleaseSection}
          </Grid>
          {action}
        </Grid>
      </div>
    </div>
  )

  return <PageLayout body={body} scroll />
}
