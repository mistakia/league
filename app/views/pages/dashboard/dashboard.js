import React from 'react'
import { List } from 'immutable'
import dayjs from 'dayjs'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Container from '@mui/material/Container'
import Grid from '@mui/material/Grid'
import NotInterestedIcon from '@mui/icons-material/NotInterested'
import Toolbar from '@mui/material/Toolbar'

import TeamName from '@components/team-name'
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
    roster,
    isBeforeTransitionEnd
  } = this.props

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
  for (const position of constants.positions) {
    if (!groups[position]) groups[position] = []
    groups[position] = players.active
      .filter((pMap) => pMap.get('pos') === position)
      .sort(
        (a, b) =>
          b.getIn(['lineups', 'starts'], 0) - a.getIn(['lineups', 'starts'], 0)
      )
  }

  const activeItems = []
  let activePlayers = new List()
  const cutlist_pids = cutlist.map((cMap) => cMap.get('pid')).toJS()
  for (const position in groups) {
    const players = groups[position]
    for (const playerMap of players) {
      if (
        !constants.isRegularSeason &&
        cutlist_pids.includes(playerMap.get('pid'))
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
      <PlayerRoster
        key={playerMap.get('pid')}
        playerMap={playerMap}
        isTransition
      />
    )
  }

  const reserveIRItems = []
  for (const playerMap of players.ir) {
    if (!playerMap.get('pid')) continue
    reserveIRItems.push(
      <PlayerRoster key={playerMap.get('pid')} playerMap={playerMap} />
    )

    if (
      !isReserveEligible({
        status: playerMap.get('status'),
        injury_status: playerMap.get('injury_status')
      })
    ) {
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

    if (
      !isReserveCovEligible({
        status: playerMap.get('status'),
        injury_status: playerMap.get('injury_status')
      })
    ) {
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
          <div>
            {playerMap.get('name', 'N/A')} has a poaching claim that will be
            processed {processingTime.fromNow()} on{' '}
            {processingTime.format('dddd, h:mm a')}.
          </div>
          <div>
            Submitted by: <TeamName tid={poach.tid} />
          </div>
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
          {isBeforeTransitionEnd && Boolean(transitionPlayers.size) && (
            <Grid item xs={12}>
              <DashboardPlayersTable
                title='Restricted Free Agents'
                items={transitionItems}
                isTransition
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
              space={roster.availableSpace}
              total={activePlayers}
            />
          </Grid>
          <Grid item xs={12}>
            <DashboardPlayersTable
              items={practiceItems}
              title='Practice Squad'
              space={roster.availablePracticeSpace}
            />
          </Grid>
          <Grid item xs={12}>
            {Boolean(reserveIRItems.length) && (
              <DashboardPlayersTable
                items={reserveIRItems}
                title='Reserve/IR'
                space={roster.availableReserveSpace}
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
          <DashboardTeamSummary tid={teamId} />
          <DashboardTeamValue tid={teamId} />
          <DashboardLeaguePositionalValue tid={teamId} />
          <DashboardByeWeeks tid={teamId} />
        </Grid>
      </Grid>
    </Container>
  )

  return <PageLayout body={body} scroll />
}
