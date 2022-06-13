import React from 'react'
import { List } from 'immutable'
import dayjs from 'dayjs'
import Alert from '@material-ui/lab/Alert'
import AlertTitle from '@material-ui/lab/AlertTitle'
import Container from '@material-ui/core/Container'
import Grid from '@material-ui/core/Grid'
import NotInterestedIcon from '@material-ui/icons/NotInterested'
import Toolbar from '@material-ui/core/Toolbar'

import DashboardDraftPicks from '@components/dashboard-draft-picks'
import DashboardByeWeeks from '@components/dashboard-bye-weeks'
import DashboardLeaguePositionalValue from '@components/dashboard-league-positional-value'
import DashboardPlayersTable from '@components/dashboard-players-table'
import DashboardTeamSummary from '@components/dashboard-team-summary'
import DashboardTeamValue from '@components/dashboard-team-value'
import PlayerRoster from '@components/player-roster'
import PageLayout from '@layouts/page'
import {
  constants,
  isReserveEligible,
  isReserveCovEligible,
  getFreeAgentPeriod
} from '@common'

import './dashboard.styl'

export default function DashboardPage() {
  const {
    players,
    transitionPlayers,
    cutlist,
    picks,
    league,
    waivers,
    poaches,
    teamId,
    roster
  } = this.props

  const { positions } = constants

  const notices = []
  if (league.adate) {
    const faPeriod = getFreeAgentPeriod(league.adate)
    if (constants.season.now.isBefore(faPeriod.start)) {
      notices.push(
        <Alert key='fa-period' severity='warning'>
          <AlertTitle>
            Free Agency (FA) period begins {dayjs().to(faPeriod.start)}
          </AlertTitle>
          The player pool will lock in preparation for the auction. You will not
          be able to release any players once the FA period begins.
          <br />
          <br />
          {faPeriod.start.local().format('[Starts] l [at] LT z')}
        </Alert>
      )
    }
  }

  const groups = {}
  for (const position of positions) {
    if (!groups[position]) groups[position] = []
    groups[position] = players.active
      .filter((p) => p.pos === position)
      .sort(
        (a, b) =>
          b.getIn(['lineups', 'starts'], 0) - a.getIn(['lineups', 'starts'], 0)
      )
  }

  const activeItems = []
  let activePlayers = new List()
  const cutlistPlayerIds = cutlist.map((c) => c.pid).toJS()
  for (const position in groups) {
    const players = groups[position]
    for (const playerMap of players) {
      if (
        !constants.season.isRegularSeason &&
        cutlistPlayerIds.includes(playerMap.get('pid'))
      )
        continue
      if (!playerMap.get('pid')) continue
      activePlayers = activePlayers.push(playerMap)
      activeItems.push(
        <PlayerRoster key={playerMap.get('pid')} playerMap={playerMap} />
      )
    }
  }

  const transitionItems = []
  for (const playerMap of transitionPlayers.valueSeq()) {
    transitionItems.push(
      <PlayerRoster key={playerMap.get('pid')} playerMap={playerMap} />
    )
  }

  const reserveIRItems = []
  for (const playerMap of players.ir) {
    if (!playerMap.get('pid')) continue
    reserveIRItems.push(
      <PlayerRoster key={playerMap.get('pid')} playerMap={playerMap} />
    )

    if (!isReserveEligible(playerMap.toJS())) {
      notices.push(
        <Alert key={playerMap.get('pid')} severity='error'>
          <AlertTitle>
            {playerMap.get('name', 'N/A')} not eligible for Reserve/IR
          </AlertTitle>
          You will need to activate or release him before you can make any
          acquisitions or claims.
        </Alert>
      )
    }
  }

  const reserveCOVItems = []
  for (const playerMap of players.cov) {
    if (!playerMap.get('pid')) continue
    reserveCOVItems.push(
      <PlayerRoster key={playerMap.get('pid')} playerMap={playerMap} />
    )

    if (!isReserveCovEligible(playerMap.toJS())) {
      notices.push(
        <Alert key={playerMap.get('pid')} severity='error'>
          <AlertTitle>
            {playerMap.get('name', 'N/A')} not eligible for Reserve/COVID-19
          </AlertTitle>
          You will need to activate or release him before you can make any
          acquisitions or claims.
        </Alert>
      )
    }
  }

  const practiceItems = []
  for (const playerMap of players.practice) {
    if (!playerMap.get('pid')) continue
    practiceItems.push(
      <PlayerRoster key={playerMap.get('pid')} playerMap={playerMap} />
    )

    const poach = poaches.find(
      (p) => p.getIn(['playerMap', 'pid']) === playerMap.get('pid')
    )
    if (poach) {
      const processingTime = dayjs.unix(poach.submitted).add('48', 'hours')
      notices.push(
        <Alert key={playerMap.get('pid')} severity='warning'>
          {playerMap.get('name', 'N/A')} has a poaching claim that will be
          processed {processingTime.fromNow()} on{' '}
          {processingTime.format('dddd, h:mm a')}.
        </Alert>
      )
    }
  }

  const teamPoaches = poaches.filter((p) => p.tid === teamId)

  const body = (
    <Container maxWidth='lg' classes={{ root: 'dashboard' }}>
      <Grid container spacing={2} alignItems='flex-start'>
        <Grid container item xs={12} md={8}>
          {notices.length ? (
            <Grid item xs={12}>
              {notices}
            </Grid>
          ) : null}
          {Boolean(transitionPlayers.size) && (
            <Grid item xs={12}>
              <DashboardPlayersTable
                title='Restricted Free Agents'
                items={transitionItems}
              />
            </Grid>
          )}
          {Boolean(waivers.poach.size) && (
            <Grid item xs={12}>
              <DashboardPlayersTable
                title='Poaching Waiver Claims'
                claims={waivers.poach}
                waiverType='poach'
              />
            </Grid>
          )}
          {Boolean(waivers.active.size) && (
            <Grid item xs={12}>
              <DashboardPlayersTable
                title='Active Roster Waiver Claims'
                claims={waivers.active}
                waiverType='active'
              />
            </Grid>
          )}
          {Boolean(waivers.practice.size) && (
            <Grid item xs={12}>
              <DashboardPlayersTable
                title='Practice Squad Waiver Claims'
                claims={waivers.practice}
                waiverType='practice'
              />
            </Grid>
          )}
          {Boolean(teamPoaches.size) && (
            <Grid item xs={12}>
              <DashboardPlayersTable
                title='Poaching Claims'
                poaches={teamPoaches}
              />
            </Grid>
          )}
          {Boolean(cutlist.size) && (
            <Grid item xs={12}>
              <DashboardPlayersTable
                title={
                  <>
                    Cutlist
                    <NotInterestedIcon />
                  </>
                }
                cutlist={cutlist}
                total={cutlist}
              />
            </Grid>
          )}
          <Grid item xs={12}>
            <DashboardPlayersTable
              items={activeItems}
              title='Active Roster'
              limit={roster.activeRosterLimit}
              total={activePlayers}
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
            {Boolean(reserveIRItems.length) && (
              <DashboardPlayersTable
                items={reserveIRItems}
                title='Reserve/IR'
                limit={league.ir}
              />
            )}
          </Grid>
          <Grid item xs={12}>
            {Boolean(reserveCOVItems.length) && (
              <DashboardPlayersTable
                items={reserveCOVItems}
                title='Reserve/COVID-19'
              />
            )}
          </Grid>
          <Grid item xs={12}>
            <div className='section'>
              <Toolbar>
                <div className='dashboard__section-header-title'>
                  Draft Picks
                </div>
              </Toolbar>
              <DashboardDraftPicks picks={picks} league={league} />
            </div>
          </Grid>
        </Grid>
        <Grid item xs={12} md={4}>
          <DashboardTeamSummary />
          <DashboardTeamValue />
          <DashboardLeaguePositionalValue />
          <DashboardByeWeeks />
        </Grid>
      </Grid>
    </Container>
  )

  return <PageLayout body={body} scroll />
}
