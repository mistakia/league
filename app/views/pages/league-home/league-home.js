import React, { useEffect, useMemo } from 'react'
import { useParams, useNavigate, NavLink } from 'react-router-dom'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import dayjs from 'dayjs'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Grid from '@mui/material/Grid'

import Icon from '@components/icon'
import LeagueHeader from '@components/league-header'
import DashboardLeaguePositionalValue from '@components/dashboard-league-positional-value'
import DashboardPlayersTable from '@components/dashboard-players-table'
import PlayerRoster from '@components/player-roster'
import LeagueRecentTransactions from '@components/league-recent-transactions'
import LeagueScheduleList from '@components/league-schedule-list'
import PoachNotice from '@components/poach-notice'
import PageLayout from '@layouts/page'
import Notices from '@components/notices'
import CopyMarkdownButton from '@components/copy-markdown-button'
import { current_season, league_defaults } from '#constants'
import {
  isReserveEligible,
  isReserveCovEligible,
  get_free_agent_period,
  get_restricted_free_agency_nomination_window,
  toPercent
} from '#libs-shared'
import { get_restricted_free_agency_notices } from '@core/utils/restricted-free-agency-notices'
import { teams_to_array } from '@core/utils'
import RestrictedFreeAgencySchedule from '@components/restricted-free-agency-schedule'
import RestrictedFreeAgencyNomination from '@components/restricted-free-agency-nomination'

import './league-home.styl'

// Compact odds table over the teams the page already loads. The markup mirrors
// `standings.js` rather than sharing a component with it, because extracting one
// would edit the standings page while the Material UI removal is in flight
// there; the follow-up to extract it is filed on this page's task.
function LeagueOdds({ teams, leagueId }) {
  // Playoff and bye odds are stale once the postseason starts, so both columns
  // leave together -- header cells included, or the remaining columns misalign
  const is_regular_season =
    current_season.week <= current_season.regular_season_final_week

  const sorted = teams
    .toList()
    .sort((a, b) => (b.championship_odds || 0) - (a.championship_odds || 0))

  const has_odds = sorted.some(
    (team) =>
      team.playoff_odds !== null ||
      team.bye_odds !== null ||
      team.championship_odds !== null
  )

  if (!has_odds) return null

  return (
    <div className='section'>
      <div className='heading__section-title'>Odds</div>
      <div className='league__gloss'>
        Simulated from the current rosters and the remaining schedule. The
        season has not started, so these are projections rather than standings;
        full records are on the standings page.
      </div>
      <div className='table__container'>
        <div className='table__row table__head'>
          <div className='table__cell text lead-cell sticky__column'>Team</div>
          {is_regular_season && (
            <div className='table__cell metric'>Playoff Odds</div>
          )}
          {is_regular_season && (
            <div className='table__cell metric'>Bye Odds</div>
          )}
          <div className='table__cell metric'>Champ Odds</div>
        </div>
        {sorted.map((team) => (
          <div className='table__row' key={team.team_id}>
            <div className='table__cell text lead-cell sticky__column'>
              <div className='table__cell-text'>{team.name}</div>
            </div>
            {is_regular_season && (
              <div className='table__cell metric'>
                {toPercent(team.playoff_odds)}
              </div>
            )}
            {is_regular_season && (
              <div className='table__cell metric'>
                {toPercent(team.bye_odds)}
              </div>
            )}
            <div className='table__cell metric'>
              {toPercent(team.championship_odds)}
            </div>
          </div>
        ))}
      </div>
      <NavLink
        className='league__home-link'
        to={`/leagues/${leagueId}/standings`}
      >
        Full standings and records
      </NavLink>
    </div>
  )
}

LeagueOdds.propTypes = {
  teams: ImmutablePropTypes.map,
  leagueId: PropTypes.number
}

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
  is_team_manager,
  is_logged_in,
  has_league_events,
  has_recent_transactions
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

  // The "Next nomination" card only exists while this team has a future
  // nomination window; the schedule beside it spans the full row when it is
  // gone, so the layout keys on the same predicate the card renders from
  const has_rfa_nomination = useMemo(() => {
    if (!is_before_restricted_free_agency_end) return false
    return Boolean(
      get_restricted_free_agency_nomination_window({
        league,
        teams: teams_to_array(teams),
        team_id: teamId,
        current_timestamp: Math.floor(Date.now() / 1000 / 60) * 60
      })
    )
  }, [league, teams, teamId, is_before_restricted_free_agency_end])

  const notice_items = [...rfa_notices]

  // Second-person copy below addresses a manager about their own roster, so it
  // is gated on membership -- a visitor should never read what they will not be
  // able to release. The auction close itself still reaches everyone, through
  // the dates section.
  if (is_team_manager && league.free_agency_period_start) {
    const fa_period = get_free_agent_period(league)
    if (current_season.now.isBefore(fa_period.start)) {
      notice_items.push(
        <Alert key='fa-period' severity='info'>
          <AlertTitle>
            Free Agency (FA) period begins {dayjs().to(fa_period.start)}
          </AlertTitle>
          The player pool will lock in preparation for the auction. You will not
          be able to release any players once the FA period begins. Any players
          left on Reserve at the start of the FA period will be ineligible to
          enter a starting lineup for the first six weeks of the season.
          <br />
          <br />
          {fa_period.start.local().format('[Starts] l [at] LT z')}
        </Alert>
      )
    }
  }

  // Only announced restricted free agents and this team's own nominee are
  // listed. A tag that has not been announced is private to the team holding
  // it, so there is no league-wide roster of pending tags here.
  const active_free_agent_items = []
  const nominated_free_agent_items = []
  restricted_free_agency_players.forEach((player_map, index) => {
    const is_processed = player_map.get('restricted_free_agency_tag_processed')
    if (is_processed) {
      return
    }

    const is_announced = player_map.get('restricted_free_agency_tag_announced')
    const is_nominated = player_map.get('restricted_free_agency_tag_nominated')

    if (is_announced) {
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
    }
  })

  for (const player_map of is_team_manager
    ? [...players.reserve_short_term, ...players.reserve_long_term]
    : []) {
    if (!player_map.get('pid')) continue

    const practice_week = player_map.get('practice_week')
    const practice_data = practice_week ? practice_week.toJS() : null

    if (
      !isReserveEligible({
        roster_status: player_map.get('roster_status'),
        game_designation: player_map.get('game_designation'),
        prior_week_inactive: player_map.get('prior_week_inactive'),
        prior_week_ruled_out: player_map.get('prior_week_ruled_out'),
        week: current_season.week,
        is_regular_season: current_season.is_regular_season,
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

  for (const player_map of is_team_manager ? players.cov : []) {
    if (!player_map.get('pid')) continue

    if (
      !isReserveCovEligible({
        roster_status: player_map.get('roster_status')
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

  // Everything a manager has to act on, collected so the heading can be omitted
  // when there is nothing under it. An empty section beneath a label is worse
  // than no section at all.
  const manager_action_items = []

  if (notice_items.length) {
    manager_action_items.push(
      <Grid item xs={12} key='notices'>
        <Notices notices={notice_items} />
      </Grid>
    )
  }

  if (has_rfa_nomination) {
    manager_action_items.push(
      <Grid item xs={12} key='rfa-nomination'>
        <RestrictedFreeAgencyNomination />
      </Grid>
    )
  }

  if (waivers.poach.size) {
    manager_action_items.push(
      <Grid item xs={12} key='waivers-poach'>
        <DashboardPlayersTable
          title='Poaching Waiver Claims'
          claims={waivers.poach}
          waiverType='poach'
        />
      </Grid>
    )
  }

  if (waivers.active.size) {
    manager_action_items.push(
      <Grid item xs={12} key='waivers-active'>
        <DashboardPlayersTable
          title='Active Roster Waiver Claims'
          claims={waivers.active}
          waiverType='active'
        />
      </Grid>
    )
  }

  if (waivers.practice.size) {
    manager_action_items.push(
      <Grid item xs={12} key='waivers-practice'>
        <DashboardPlayersTable
          title='Practice Squad Waiver Claims'
          claims={waivers.practice}
          waiverType='practice'
        />
      </Grid>
    )
  }

  if (team_poaches.size) {
    manager_action_items.push(
      <Grid item xs={12} key='poaching-claims'>
        <DashboardPlayersTable title='Poaching Claims' poaches={team_poaches} />
      </Grid>
    )
  }

  if (cutlist.size) {
    manager_action_items.push(
      <Grid item xs={12} key='cutlist'>
        <DashboardPlayersTable
          title={
            <>
              Cutlist
              <Icon name='not-interested' />
            </>
          }
          cutlist={cutlist}
          total={cutlist}
          {...{ percentiles }}
        />
      </Grid>
    )
  }

  const body = (
    <div className='league-container league__home'>
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <LeagueHeader />
          {league.league_id && (
            <div className='copy-markdown-button-row'>
              <CopyMarkdownButton path={`/leagues/${league.league_id}.md`} />
            </div>
          )}
        </Grid>
        {manager_action_items.length > 0 && (
          <Grid item xs={12}>
            <div className='heading__section-title'>Manager Actions</div>
            <Grid container spacing={2}>
              {manager_action_items}
            </Grid>
          </Grid>
        )}
        <Grid item xs={12}>
          <LeagueOdds {...{ teams, leagueId }} />
        </Grid>
        {has_league_events && (
          <Grid item xs={12} className='league-schedule'>
            <div className='section'>
              <div className='heading__section-title'>Dates</div>
              <LeagueScheduleList />
            </div>
          </Grid>
        )}
        {/* Announced restricted free agents and the nomination schedule are
            league-wide public content, not a manager's own to-do list */}
        {is_before_restricted_free_agency_end && (
          <Grid item xs={12}>
            <RestrictedFreeAgencySchedule />
          </Grid>
        )}
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
        <Grid item xs={12} className='league-positional-value'>
          <div className='heading__section-title'>Projected Points+</div>
          <div className='league__gloss'>
            Each bar totals the points a roster is projected to add above a
            replacement-level starter, split by position, with draft picks
            valued alongside.
          </div>
          <DashboardLeaguePositionalValue />
        </Grid>
        {has_recent_transactions && (
          <Grid item xs={12} className='league-recent-transactions'>
            <div className='heading__section-title'>Recent Transactions</div>
            <div className='league__gloss'>
              The league&apos;s latest signings, releases, and claims.
            </div>
            <LeagueRecentTransactions />
          </Grid>
        )}
        {!is_logged_in && (
          <Grid item xs={12}>
            <div className='league__home-cta'>
              <NavLink className='league__home-link' to='/genesis-league'>
                What is the Genesis League?
              </NavLink>
            </div>
          </Grid>
        )}
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
  is_team_manager: PropTypes.bool,
  is_logged_in: PropTypes.bool,
  has_league_events: PropTypes.bool,
  has_recent_transactions: PropTypes.bool
}
