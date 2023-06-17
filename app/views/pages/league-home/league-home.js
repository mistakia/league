import React, { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import dayjs from 'dayjs'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Container from '@mui/material/Container'
import Grid from '@mui/material/Grid'
import NotInterestedIcon from '@mui/icons-material/NotInterested'

import LeagueHeader from '@components/league-header'
import TeamName from '@components/team-name'
import DashboardLeaguePositionalValue from '@components/dashboard-league-positional-value'
import DashboardPlayersTable from '@components/dashboard-players-table'
import PlayerRoster from '@components/player-roster'
import LeagueRecentTransactions from '@components/league-recent-transactions'
import PageLayout from '@layouts/page'
import {
  constants,
  isReserveEligible,
  isReserveCovEligible,
  getFreeAgentPeriod,
  getPoachProcessingTime
} from '@libs-shared'

import './league-home.styl'

export default function LeagueHomePage({
  players,
  transitionPlayers,
  cutlist,
  league,
  waivers,
  poaches,
  teamId,
  isBeforeTransitionEnd,
  loadLeaguePlayers,
  loadDraftPickValue,
  loadRecentTransactions,
  loadTeams,
  loadRosters,
  leagueId,
  percentiles
}) {
  const navigate = useNavigate()
  const { lid } = useParams()

  useEffect(() => {
    if (isNaN(lid)) {
      return navigate('/', { replace: true })
    }
  }, [lid, navigate])

  useEffect(() => {
    loadTeams(leagueId)
    loadRosters(leagueId)
    loadLeaguePlayers()
    loadDraftPickValue()
    loadRecentTransactions()
  }, [
    leagueId,
    loadTeams,
    loadRosters,
    loadLeaguePlayers,
    loadDraftPickValue,
    loadRecentTransactions
  ])

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

  const transitionItems = []
  transitionPlayers.forEach((playerMap, index) => {
    transitionItems.push(
      <PlayerRoster
        key={index}
        playerMap={playerMap}
        isTransition
        {...{ percentiles }}
      />
    )
  })

  for (const playerMap of players.ir) {
    if (!playerMap.get('pid')) continue

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

  for (const playerMap of players.cov) {
    if (!playerMap.get('pid')) continue

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

  for (const poach of poaches) {
    const playerMap = poach.get('playerMap')
    if (!playerMap) continue

    const processingTime = getPoachProcessingTime(poach.submitted)
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

  const teamPoaches = poaches.filter((p) => p.tid === teamId)

  const body = (
    <Container maxWidth='md' classes={{ root: 'league__home' }}>
      <Grid container spacing={2} alignItems='flex-start'>
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
              {...{ percentiles }}
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
        <Grid item xs={12}>
          <LeagueHeader />
        </Grid>
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
              {...{ percentiles }}
            />
          </Grid>
        )}
        <Grid item xs={12}>
          <DashboardLeaguePositionalValue tid={teamId} />
        </Grid>
        <Grid item xs={12}>
          <LeagueRecentTransactions />
        </Grid>
      </Grid>
    </Container>
  )

  return <PageLayout body={body} scroll />
}

LeagueHomePage.propTypes = {
  players: PropTypes.object,
  transitionPlayers: ImmutablePropTypes.map,
  cutlist: ImmutablePropTypes.list,
  league: PropTypes.object,
  waivers: PropTypes.object,
  loadLeaguePlayers: PropTypes.func,
  loadDraftPickValue: PropTypes.func,
  poaches: ImmutablePropTypes.list,
  teamId: PropTypes.number,
  isBeforeTransitionEnd: PropTypes.bool,
  loadRecentTransactions: PropTypes.func,
  loadTeams: PropTypes.func,
  leagueId: PropTypes.number,
  loadRosters: PropTypes.func,
  percentiles: PropTypes.object
}
