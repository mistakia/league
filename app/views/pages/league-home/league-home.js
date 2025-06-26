import React, { useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import dayjs from 'dayjs'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Grid from '@mui/material/Grid'
import NotInterestedIcon from '@mui/icons-material/NotInterested'

import LeagueHeader from '@components/league-header'
import DashboardLeaguePositionalValue from '@components/dashboard-league-positional-value'
import DashboardPlayersTable from '@components/dashboard-players-table'
import PlayerRoster from '@components/player-roster'
import LeagueRecentTransactions from '@components/league-recent-transactions'
import PoachNotice from '@components/poach-notice'
import PageLayout from '@layouts/page'
import Notices from '@components/notices'
import {
  constants,
  isReserveEligible,
  isReserveCovEligible,
  getFreeAgentPeriod
} from '@libs-shared'
import { get_restricted_free_agency_notices } from '@core/utils/restricted-free-agency-notices'

import './league-home.styl'

export default function LeagueHomePage({
  players,
  restrictedFreeAgencyPlayers,
  cutlist,
  league,
  waivers,
  poaches,
  teamId,
  isBeforeRestrictedFreeAgencyEnd,
  load_league_players,
  loadDraftPickValue,
  loadRecentTransactions,
  loadTeams,
  load_rosters,
  leagueId,
  percentiles,
  teams,
  is_team_manager
}) {
  const navigate = useNavigate()
  const { lid } = useParams()

  useEffect(() => {
    if (isNaN(lid)) {
      return navigate('/', { replace: true })
    }

    if (Number(lid) === constants.DEFAULTS.LEAGUE_ID) {
      return navigate(`/leagues/${lid}/players`, { replace: true })
    }
  }, [lid, navigate])

  useEffect(() => {
    if (leagueId) loadTeams(leagueId)
    if (leagueId) load_rosters(leagueId)
    load_league_players()
    loadDraftPickValue()
    loadRecentTransactions()
  }, [
    leagueId,
    loadTeams,
    load_rosters,
    load_league_players,
    loadDraftPickValue,
    loadRecentTransactions
  ])

  const rfa_notices = useMemo(
    () =>
      get_restricted_free_agency_notices({
        league,
        teams,
        team_id: teamId,
        restricted_free_agency_players: restrictedFreeAgencyPlayers,
        is_team_manager
      }),
    [league, teams, teamId, restrictedFreeAgencyPlayers, is_team_manager]
  )

  const notice_items = [...rfa_notices]

  if (league.free_agency_live_auction_start) {
    const faPeriod = getFreeAgentPeriod(league)
    if (constants.season.now.isBefore(faPeriod.start)) {
      notice_items.push(
        <Alert key='fa-period' severity='info'>
          <AlertTitle>
            Free Agency (FA) period begins {dayjs().to(faPeriod.start)}
          </AlertTitle>
          The player pool will lock in preparation for the auction. You will not
          be able to release any players once the FA period begins. Any players
          left on Reserve at the start of the FA period will be ineligble to
          enter a starting lineup for the first six weeks of the season.
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

  const restrictedFreeAgencyItems = []
  const active_free_agent_items = []
  const nominated_free_agent_items = []
  restrictedFreeAgencyPlayers.forEach((playerMap, index) => {
    const is_processed = playerMap.get('restricted_free_agency_tag_processed')
    if (is_processed) {
      return
    }

    const is_announced = playerMap.get('restricted_free_agency_tag_announced')
    const is_active = !is_processed && is_announced
    const is_nominated = playerMap.get('restricted_free_agency_tag_nominated')

    if (is_active) {
      active_free_agent_items.push(
        <PlayerRoster
          key={index}
          playerMap={playerMap}
          isRestrictedFreeAgency
          {...{ percentiles }}
        />
      )
    } else if (is_nominated) {
      nominated_free_agent_items.push(
        <PlayerRoster
          key={index}
          playerMap={playerMap}
          isRestrictedFreeAgency
          {...{ percentiles }}
        />
      )
    } else {
      restrictedFreeAgencyItems.push(
        <PlayerRoster
          key={index}
          playerMap={playerMap}
          isRestrictedFreeAgency
          {...{ percentiles }}
        />
      )
    }
  })

  for (const playerMap of [...players.ir, ...players.ir_long_term]) {
    if (!playerMap.get('pid')) continue

    if (
      !isReserveEligible({
        nfl_status: playerMap.get('nfl_status'),
        injury_status: playerMap.get('injury_status')
      })
    ) {
      notice_items.push(
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
        nfl_status: playerMap.get('nfl_status')
      })
    ) {
      notice_items.push(
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

    notice_items.push(<PoachNotice key={playerMap.get('pid')} poach={poach} />)
  }

  const teamPoaches = poaches.filter((p) => p.tid === teamId)

  const body = (
    <div className='league-container league__home'>
      <Grid container spacing={2} alignItems='flex-start'>
        {notice_items.length ? (
          <Grid item xs={12}>
            <Notices notices={notice_items} />
          </Grid>
        ) : null}
        {active_free_agent_items.length > 0 && (
          <Grid item xs={12}>
            <DashboardPlayersTable
              title='Announced Restricted Free Agent'
              items={active_free_agent_items}
              isRestrictedFreeAgency
              {...{ percentiles }}
            />
          </Grid>
        )}
        {nominated_free_agent_items.length > 0 && (
          <Grid item xs={12}>
            <DashboardPlayersTable
              title='Designated Next Restricted Free Agent Nominee'
              items={nominated_free_agent_items}
              isRestrictedFreeAgency
              {...{ percentiles }}
            />
          </Grid>
        )}
        {isBeforeRestrictedFreeAgencyEnd &&
          Boolean(restrictedFreeAgencyPlayers.size) && (
            <Grid item xs={12}>
              <DashboardPlayersTable
                title='Restricted Free Agents'
                items={restrictedFreeAgencyItems}
                isRestrictedFreeAgency
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
        <Grid item xs={12} className='league-positional-value'>
          <DashboardLeaguePositionalValue tid={teamId} />
        </Grid>
        <Grid item xs={12} className='league-recent-transactions'>
          <LeagueRecentTransactions />
        </Grid>
      </Grid>
    </div>
  )

  return <PageLayout body={body} scroll />
}

LeagueHomePage.propTypes = {
  players: PropTypes.object,
  restrictedFreeAgencyPlayers: ImmutablePropTypes.map,
  cutlist: ImmutablePropTypes.list,
  league: PropTypes.object,
  waivers: PropTypes.object,
  load_league_players: PropTypes.func,
  loadDraftPickValue: PropTypes.func,
  poaches: ImmutablePropTypes.list,
  teamId: PropTypes.number,
  isBeforeRestrictedFreeAgencyEnd: PropTypes.bool,
  loadRecentTransactions: PropTypes.func,
  loadTeams: PropTypes.func,
  leagueId: PropTypes.number,
  load_rosters: PropTypes.func,
  percentiles: PropTypes.object,
  teams: PropTypes.object,
  is_team_manager: PropTypes.bool
}
