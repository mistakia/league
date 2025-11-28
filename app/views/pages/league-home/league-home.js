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
import { current_season, fantasy_positions, league_defaults } from '@constants'
import {
  isReserveEligible,
  isReserveCovEligible,
  get_free_agent_period
} from '@libs-shared'
import { get_restricted_free_agency_notices } from '@core/utils/restricted-free-agency-notices'

import './league-home.styl'

export default function LeagueHomePage({
  players,
  restricted_free_agency_players,
  cutlist,
  league,
  waivers,
  poaches,
  teamId,
  is_before_restricted_free_agency_end,
  load_league_players,
  load_draft_pick_value,
  load_recent_transactions,
  load_teams,
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

    if (Number(lid) === league_defaults.LEAGUE_ID) {
      return navigate(`/leagues/${lid}/players`, { replace: true })
    }
  }, [lid, navigate])

  useEffect(() => {
    if (leagueId) load_teams(leagueId)
    if (leagueId) load_rosters(leagueId)
    load_league_players()
    load_draft_pick_value()
    load_recent_transactions()
  }, [
    leagueId,
    load_teams,
    load_rosters,
    load_league_players,
    load_draft_pick_value,
    load_recent_transactions
  ])

  const rfa_notices = useMemo(
    () =>
      get_restricted_free_agency_notices({
        league,
        teams,
        team_id: teamId,
        restricted_free_agency_players,
        is_team_manager
      }),
    [league, teams, teamId, restricted_free_agency_players, is_team_manager]
  )

  const notice_items = [...rfa_notices]

  if (league.free_agency_live_auction_start) {
    const fa_period = get_free_agent_period(league)
    if (current_season.now.isBefore(fa_period.start)) {
      notice_items.push(
        <Alert key='fa-period' severity='info'>
          <AlertTitle>
            Free Agency (FA) period begins {dayjs().to(fa_period.start)}
          </AlertTitle>
          The player pool will lock in preparation for the auction. You will not
          be able to release any players once the FA period begins. Any players
          left on Reserve at the start of the FA period will be ineligble to
          enter a starting lineup for the first six weeks of the season.
          <br />
          <br />
          {fa_period.start.local().format('[Starts] l [at] LT z')}
        </Alert>
      )
    }
  }

  const groups = {}
  for (const position of fantasy_positions) {
    if (!groups[position]) groups[position] = []
    groups[position] = players.active
      .filter((pMap) => pMap.get('pos') === position)
      .sort(
        (a, b) =>
          b.getIn(['lineups', 'starts'], 0) - a.getIn(['lineups', 'starts'], 0)
      )
  }

  const restricted_free_agency_items = []
  const active_free_agent_items = []
  const nominated_free_agent_items = []
  restricted_free_agency_players.forEach((player_map, index) => {
    const is_processed = player_map.get('restricted_free_agency_tag_processed')
    if (is_processed) {
      return
    }

    const is_announced = player_map.get('restricted_free_agency_tag_announced')
    const is_active = !is_processed && is_announced
    const is_nominated = player_map.get('restricted_free_agency_tag_nominated')

    if (is_active) {
      active_free_agent_items.push(
        <PlayerRoster
          key={index}
          player_map={player_map}
          isRestrictedFreeAgency
          {...{ percentiles }}
        />
      )
    } else if (is_nominated) {
      nominated_free_agent_items.push(
        <PlayerRoster
          key={index}
          player_map={player_map}
          isRestrictedFreeAgency
          {...{ percentiles }}
        />
      )
    } else {
      restricted_free_agency_items.push(
        <PlayerRoster
          key={index}
          player_map={player_map}
          isRestrictedFreeAgency
          {...{ percentiles }}
        />
      )
    }
  })

  for (const player_map of [
    ...players.reserve_short_term,
    ...players.reserve_long_term
  ]) {
    if (!player_map.get('pid')) continue

    const practice_week = player_map.get('practice_week')
    const practice_data = practice_week ? practice_week.toJS() : null

    if (
      !isReserveEligible({
        nfl_status: player_map.get('nfl_status'),
        injury_status: player_map.get('injury_status'),
        prior_week_inactive: player_map.get('prior_week_inactive'),
        prior_week_ruled_out: player_map.get('prior_week_ruled_out'),
        week: current_season.week,
        is_regular_season: current_season.isRegularSeason,
        game_day: player_map.get('game_day'),
        practice: practice_data
      })
    ) {
      notice_items.push(
        <Alert key={player_map.get('pid')} severity='error'>
          <AlertTitle>
            {player_map.get('name', 'N/A')} not eligible for Reserve/IR
          </AlertTitle>
          You will need to activate or release him before you can make any
          acquisitions or claims.
        </Alert>
      )
    }
  }

  for (const player_map of players.cov) {
    if (!player_map.get('pid')) continue

    if (
      !isReserveCovEligible({
        nfl_status: player_map.get('nfl_status')
      })
    ) {
      notice_items.push(
        <Alert key={player_map.get('pid')} severity='error'>
          <AlertTitle>
            {player_map.get('name', 'N/A')} not eligible for Reserve/COVID-19
          </AlertTitle>
          You will need to activate or release him before you can make any
          acquisitions or claims.
        </Alert>
      )
    }
  }

  for (const poach of poaches) {
    const player_map = poach.get('player_map')
    if (!player_map) continue

    notice_items.push(<PoachNotice key={player_map.get('pid')} poach={poach} />)
  }

  const team_poaches = poaches.filter((p) => p.tid === teamId)

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
        {is_before_restricted_free_agency_end &&
          Boolean(restricted_free_agency_players.size) && (
            <Grid item xs={12}>
              <DashboardPlayersTable
                title='Restricted Free Agents'
                items={restricted_free_agency_items}
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
        {Boolean(team_poaches.size) && (
          <Grid item xs={12}>
            <DashboardPlayersTable
              title='Poaching Claims'
              poaches={team_poaches}
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
  restricted_free_agency_players: ImmutablePropTypes.map,
  cutlist: ImmutablePropTypes.list,
  league: PropTypes.object,
  waivers: PropTypes.object,
  load_league_players: PropTypes.func,
  load_draft_pick_value: PropTypes.func,
  poaches: ImmutablePropTypes.list,
  teamId: PropTypes.number,
  is_before_restricted_free_agency_end: PropTypes.bool,
  load_recent_transactions: PropTypes.func,
  load_teams: PropTypes.func,
  leagueId: PropTypes.number,
  load_rosters: PropTypes.func,
  percentiles: PropTypes.object,
  teams: PropTypes.object,
  is_team_manager: PropTypes.bool
}
