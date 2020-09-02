import React from 'react'
import moment from 'moment'
import Alert from '@material-ui/lab/Alert'
import AlertTitle from '@material-ui/lab/AlertTitle'
import Container from '@material-ui/core/Container'
import Grid from '@material-ui/core/Grid'

import DashboardPlayersTable from '@components/dashboard-players-table'
import DashboardTeamSummary from '@components/dashboard-team-summary'
import DashboardTeamValue from '@components/dashboard-team-value'
import PlayerRosterHeader from '@components/player-roster-header'
import PlayerRoster from '@components/player-roster'
import PageLayout from '@layouts/page'
import { constants } from '@common'

import './dashboard.styl'

const ValueHeader = () => (
  <PlayerRosterHeader
    tooltip='Projected points over baseline player'
    title='Value'
  />
)

const StartsHeader = () => (
  <PlayerRosterHeader
    tooltip='Projected games started'
    title='Starts'
  />
)

const PointsPlusHeader = () => (
  <PlayerRosterHeader
    tooltip='Projected starter points you would lose without player'
    title='Pts+'
  />
)

const BenchPlusHeader = () => (
  <PlayerRosterHeader
    tooltip='Projected bench points you would lose without player'
    title='Bench+'
  />
)

export default function () {
  const {
    players, picks, league, waivers, poaches, teamId
  } = this.props

  const { positions } = constants

  const warnings = []

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
      warnings.push(
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
      warnings.push(
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

    const poach = poaches.find(p => p.player.player === player.player)
    if (poach) {
      const processingTime = moment(poach.submitted, 'X').add('48', 'hours')
      warnings.push(
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

  const poachItems = []
  for (const [index, poach] of poaches.entries()) {
    if (poach.tid !== teamId) continue
    poachItems.push(
      <PlayerRoster
        key={index}
        claim={poach}
        player={poach.player}
      />
    )
  }

  const poachWaiverSection = (
    <Grid item xs={12}>
      <DashboardPlayersTable
        claim
        title='Poaching Waiver Claims'
        claims={waivers.poach}
        reorderType='poach'
      />
    </Grid>
  )

  const freeAgencyActiveWaiverSection = (
    <Grid item xs={12}>
      <DashboardPlayersTable
        claim
        title='Active Roster Waiver Claims'
        claims={waivers.active}
        reorderType='active'
      />
    </Grid>
  )

  const freeAgencyPracticeWaiverSection = (
    <Grid item xs={12}>
      <DashboardPlayersTable
        claim
        title='Practice Squad Waiver Claims'
        claims={waivers.practice}
        reorderType='practice'
      />
    </Grid>
  )

  const teamPoachSection = (
    <div className='section'>
      <div className='dashboard__section-header-title'>Poaching Claims</div>
      <div className='dashboard__section-body-header'>
        <div className='player__item-name'>Name</div>
        <div className='player__item-name'>Release</div>
        <div className='metric'>Bid</div>
        <ValueHeader />
        <StartsHeader />
        <PointsPlusHeader />
        <BenchPlusHeader />
        <div className='player__item-action' />
      </div>
      <div className='dashboard__section-body empty'>
        {poachItems}
      </div>
    </div>
  )

  const body = (
    <Container maxWidth='lg' classes={{ root: 'dashboard' }}>
      <Grid container spacing={2}>
        <Grid container item xs={12} md={8}>
          {warnings.length ? warnings : null}
          {waivers.poach.size ? poachWaiverSection : null}
          {waivers.active.size ? freeAgencyActiveWaiverSection : null}
          {waivers.practice.size ? freeAgencyPracticeWaiverSection : null}
          {poachItems.length ? teamPoachSection : null}
          <Grid item xs={12}>
            <DashboardPlayersTable items={activeItems} title='Active Roster' />
          </Grid>
          <Grid item xs={12}>
            <DashboardPlayersTable items={practiceItems} title='Practice Squad' />
          </Grid>
          <Grid item xs={12}>
            <DashboardPlayersTable items={reserveIRItems} title='Reserve/IR' />
          </Grid>
          <Grid item xs={12}>
            <DashboardPlayersTable items={reserveCOVItems} title='Reserve/COVID-19' />
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
        </Grid>
      </Grid>
    </Container>
  )

  return (
    <PageLayout body={body} scroll />
  )
}
