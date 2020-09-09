import React from 'react'
import moment from 'moment'
import Alert from '@material-ui/lab/Alert'
import AlertTitle from '@material-ui/lab/AlertTitle'
import Container from '@material-ui/core/Container'
import Grid from '@material-ui/core/Grid'

import DashboardLeaguePositionalValue from '@components/dashboard-league-positional-value'
import DashboardPlayersTable from '@components/dashboard-players-table'
import DashboardTeamSummary from '@components/dashboard-team-summary'
import DashboardTeamValue from '@components/dashboard-team-value'
import PlayerRoster from '@components/player-roster'
import PageLayout from '@layouts/page'
import { constants } from '@common'

import './dashboard.styl'

export default function () {
  const {
    players, picks, league, waivers, poaches, teamId, roster
  } = this.props

  const { positions } = constants

  const notices = []

  const groups = {}
  for (const position of positions) {
    if (!groups[position]) groups[position] = []
    groups[position] = players.active
      .filter(p => p.pos1 === position)
      .sort((a, b) => b.getIn(['lineups', 'starts'], 0) - a.getIn(['lineups', 'starts'], 0))
  }

  const activeItems = []
  for (const position in groups) {
    const players = groups[position]
    for (const player of players) {
      if (!player.player) continue
      activeItems.push(<PlayerRoster key={player.player} player={player} />)
    }
  }

  const reserveIRItems = []
  for (const player of players.ir) {
    if (!player.player) continue
    reserveIRItems.push(<PlayerRoster key={player.player} player={player} />)

    if (!player.status || player.status === 'Active') {
      notices.push(
        <Alert key={player.player} severity='error'>
          <AlertTitle>{player.name} not eligible for Reserve/IR</AlertTitle>
          You will need to activate or release him before you can make any acquisitions or claims.
        </Alert>
      )
    }
  }

  const reserveCOVItems = []
  for (const player of players.cov) {
    if (!player.player) continue
    reserveCOVItems.push(<PlayerRoster key={player.player} player={player} />)

    if (player.status !== 'Reserve/COVID-19') {
      notices.push(
        <Alert key={player.player} severity='error'>
          <AlertTitle>{player.name} not eligible for Reserve/COVID-19</AlertTitle>
          You will need to activate or release him before you can make any acquisitions or claims.
        </Alert>
      )
    }
  }

  const practiceItems = []
  for (const player of players.practice) {
    if (!player.player) continue
    practiceItems.push(<PlayerRoster key={player.player} player={player} />)

    const poach = poaches.find(p => p.getIn(['player', 'player']) === player.player)
    if (poach) {
      const processingTime = moment(poach.submitted, 'X').add('48', 'hours')
      notices.push(
        <Alert key={player.player} severity='warning'>{player.name} has a poaching claim that will be processed {processingTime.fromNow()} on {processingTime.format('dddd, h:mm a')}.</Alert>
      )
    }
  }

  const pickItems = []
  for (const pick of picks) {
    const pickNum = (pick.pick % league.nteams) || league.nteams
    const pickStr = `${pick.round}.${('0' + pickNum).slice(-2)}`
    pickItems.push(
      <div key={pick.uid} className='player__item table__row'>
        <div className='table__cell'>{pick.year}</div>
        <div className='metric table__cell'>{pick.pick && pickStr}</div>
        <div className='metric table__cell'>{pick.round}</div>
        <div className='metric table__cell'>{pick.pick}</div>
      </div>
    )
  }

  const poachWaiverSection = (
    <Grid item xs={12}>
      <DashboardPlayersTable
        title='Poaching Waiver Claims'
        claims={waivers.poach}
        waiverType='poach'
      />
    </Grid>
  )

  const freeAgencyActiveWaiverSection = (
    <Grid item xs={12}>
      <DashboardPlayersTable
        title='Active Roster Waiver Claims'
        claims={waivers.active}
        waiverType='active'
      />
    </Grid>
  )

  const freeAgencyPracticeWaiverSection = (
    <Grid item xs={12}>
      <DashboardPlayersTable
        title='Practice Squad Waiver Claims'
        claims={waivers.practice}
        waiverType='practice'
      />
    </Grid>
  )

  const teamPoaches = poaches.filter(p => p.tid === teamId)
  const teamPoachSection = (
    <Grid item xs={12}>
      <DashboardPlayersTable
        title='Poaching Claims'
        poaches={teamPoaches}
      />
    </Grid>
  )

  const body = (
    <Container maxWidth='lg' classes={{ root: 'dashboard' }}>
      <Grid container spacing={2}>
        <Grid container item xs={12} md={8}>
          {notices.length ? <Grid item xs={12}>{notices}</Grid> : null}
          {waivers.poach.size ? poachWaiverSection : null}
          {waivers.active.size ? freeAgencyActiveWaiverSection : null}
          {waivers.practice.size ? freeAgencyPracticeWaiverSection : null}
          {teamPoaches.size ? teamPoachSection : null}
          <Grid item xs={12}>
            <DashboardPlayersTable
              items={activeItems}
              title='Active Roster'
              limit={roster.activeRosterLimit}
            />
          </Grid>
          <Grid item xs={12}>
            <DashboardPlayersTable
              items={practiceItems}
              title='Practice Squad'
              limit={league.ps}
            />
          </Grid>
          <Grid item xs={12}>
            <DashboardPlayersTable
              items={reserveIRItems}
              title='Reserve/IR'
              limit={league.ir}
            />
          </Grid>
          <Grid item xs={12}>
            <DashboardPlayersTable
              items={reserveCOVItems}
              title='Reserve/COVID-19'
            />
          </Grid>
          <Grid item xs={12}>
            <div className='section table__container'>
              <div className='dashboard__section-header-title'>Draft Picks</div>
              <div className='table__row table__head'>
                <div className='table__cell'>Year</div>
                <div className='metric table__cell'>Pick</div>
                <div className='metric table__cell'>Round</div>
                <div className='metric table__cell'>Pick #</div>
              </div>
              <div className='empty'>
                {pickItems}
              </div>
            </div>
          </Grid>
        </Grid>
        <Grid item xs={12} md={4}>
          <DashboardTeamSummary />
          <DashboardTeamValue />
          <DashboardLeaguePositionalValue />
        </Grid>
      </Grid>
    </Container>
  )

  return (
    <PageLayout body={body} scroll />
  )
}
