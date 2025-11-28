import React, { useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import { useParams } from 'react-router-dom'
import { List } from 'immutable'
import Toolbar from '@mui/material/Toolbar'
import NotInterestedIcon from '@mui/icons-material/NotInterested'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import Alert from '@mui/material/Alert'

import DashboardDraftPicks from '@components/dashboard-draft-picks'
import DashboardByeWeeks from '@components/dashboard-bye-weeks'
import DashboardPlayersTable from '@components/dashboard-players-table'
import DashboardTeamSummary from '@components/dashboard-team-summary'
import DashboardTeamValue from '@components/dashboard-team-value'
import PoachNotice from '@components/poach-notice'
import PlayerRoster from '@components/player-roster'
import { current_season, fantasy_positions } from '@constants'
import { isReserveEligible, isReserveCovEligible } from '@libs-shared'
import LeagueTeamValueDeltas from '@components/league-team-value-deltas'
import Notices from '@components/notices'
import { get_restricted_free_agency_notices } from '@core/utils/restricted-free-agency-notices'

import './league-team.styl'

export default function LeagueTeam({
  league,
  load_team_players,
  roster,
  picks,
  players,
  percentiles,
  cutlist,
  is_team_manager,
  poaches,
  teams,
  restricted_free_agency_players
}) {
  const { lid, tid } = useParams()
  const [
    is_practice_squad_drafted_expanded,
    set_is_practice_squad_drafted_expanded
  ] = useState(false)

  const is_hosted_league = Boolean(league.hosted)
  const teamId = Number(tid)

  useEffect(() => {
    load_team_players({
      leagueId: Number(lid),
      teamId
    })
  }, [tid, lid, load_team_players, teamId])

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

  const activeItems = []
  let activePlayers = new List()
  const cutlist_pids = cutlist.map((cMap) => cMap.get('pid')).toJS()
  for (const position in groups) {
    const players = groups[position]
    for (const player_map of players) {
      if (!player_map.get('pid')) continue
      if (
        !current_season.isRegularSeason &&
        cutlist_pids.includes(player_map.get('pid'))
      )
        continue

      activePlayers = activePlayers.push(player_map)
      activeItems.push(
        <PlayerRoster
          key={player_map.get('pid')}
          {...{ player_map, percentiles, is_team_manager }}
        />
      )
    }
  }

  const practice_signed_items = []
  for (const player_map of players.practice_signed) {
    if (!player_map.get('pid')) continue
    practice_signed_items.push(
      <PlayerRoster
        key={player_map.get('pid')}
        {...{ player_map, percentiles }}
      />
    )
  }

  const recent_draft_cutoff = current_season.year - 2
  const all_practice_squad_drafted_players =
    players.practice_drafted || new List()

  // Sort practice squad drafted players by draft year (newest first) and draft position
  const sorted_practice_squad_drafted_players =
    all_practice_squad_drafted_players.sort((a, b) => {
      const a_draft_year = a.get('nfl_draft_year') || 0
      const b_draft_year = b.get('nfl_draft_year') || 0
      const a_draft_pos = a.get('dpos') || 9999
      const b_draft_pos = b.get('dpos') || 9999

      if (a_draft_year !== b_draft_year) {
        return b_draft_year - a_draft_year
      }

      return a_draft_pos - b_draft_pos
    })

  // Calculate how many recent players there are (for threshold count)
  const recent_practice_squad_drafted_count =
    sorted_practice_squad_drafted_players.filter((player_map) => {
      const draft_year = player_map.get('nfl_draft_year')
      return draft_year && draft_year > recent_draft_cutoff
    }).size

  const total_practice_squad_drafted_players =
    sorted_practice_squad_drafted_players.size

  // Display logic: show recent count in collapsed state, all in expanded state
  const practice_squad_drafted_players_to_display =
    is_practice_squad_drafted_expanded
      ? sorted_practice_squad_drafted_players
      : sorted_practice_squad_drafted_players.slice(
          0,
          recent_practice_squad_drafted_count
        )

  const practice_drafted_items = []
  for (const player_map of practice_squad_drafted_players_to_display) {
    if (!player_map.get('pid')) continue
    practice_drafted_items.push(
      <PlayerRoster
        key={player_map.get('pid')}
        {...{ player_map, percentiles }}
      />
    )
  }

  // Add toggle control if there are additional players beyond the recent threshold
  const additional_practice_squad_drafted_count =
    total_practice_squad_drafted_players - recent_practice_squad_drafted_count

  if (additional_practice_squad_drafted_count > 0) {
    practice_drafted_items.push(
      <div
        key='practice-squad-toggle'
        className='league-team-practice-squad-toggle'
        onClick={() => {
          set_is_practice_squad_drafted_expanded(
            !is_practice_squad_drafted_expanded
          )
        }}
      >
        {is_practice_squad_drafted_expanded ? (
          <>
            <ExpandLessIcon fontSize='small' />
            hide ({additional_practice_squad_drafted_count})
          </>
        ) : (
          <>
            <ExpandMoreIcon fontSize='small' />
            show all ({additional_practice_squad_drafted_count})
          </>
        )}
      </div>
    )
  }

  const reserveIRItems = []
  for (const player_map of players.reserve_short_term) {
    if (!player_map.get('pid')) continue
    reserveIRItems.push(
      <PlayerRoster
        key={player_map.get('pid')}
        {...{ player_map, percentiles }}
      />
    )
  }

  const reserveIRLongTermItems = []
  for (const player_map of players.reserve_long_term) {
    if (!player_map.get('pid')) continue
    reserveIRLongTermItems.push(
      <PlayerRoster
        key={player_map.get('pid')}
        {...{ player_map, percentiles }}
      />
    )
  }

  const reserveCOVItems = []
  for (const player_map of players.cov) {
    if (!player_map.get('pid')) continue
    reserveCOVItems.push(
      <PlayerRoster
        key={player_map.get('pid')}
        {...{ player_map, percentiles }}
      />
    )
  }

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

  // Add reserve notices
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
          {player_map.get('name', 'N/A')} is not eligible for Reserve/IR
          {is_team_manager
            ? '. You will need to activate or release him before you can make any acquisitions or claims.'
            : ''}
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
          {player_map.get('name', 'N/A')} is not eligible for Reserve/COVID-19
          {is_team_manager
            ? '. You will need to activate or release him before you can make any acquisitions or claims.'
            : ''}
        </Alert>
      )
    }
  }

  // Add poach notices
  for (const poach of poaches) {
    const player_map = poach.get('player_map')
    if (!player_map) continue

    const player_tid = poach.get('player_tid')
    if (player_tid !== teamId) continue

    notice_items.push(<PoachNotice key={player_map.get('pid')} poach={poach} />)
  }

  return (
    <div className='league-team-container'>
      <div className='league-team-main'>
        <div className='league-team-main-section'>
          <LeagueTeamValueDeltas tid={teamId} />
        </div>
        {notice_items.length > 0 && (
          <div className='league-team-notices-container'>
            <Notices notices={notice_items} />
          </div>
        )}
        {Boolean(cutlist.size) && is_team_manager && (
          <div className='league-team-main-section'>
            <DashboardPlayersTable
              title={
                <>
                  Cutlist
                  <NotInterestedIcon />
                </>
              }
              cutlist={cutlist}
              total={cutlist}
              {...{ percentiles, is_team_manager }}
            />
          </div>
        )}
        <div className='league-team-main-section'>
          <DashboardPlayersTable
            items={activeItems}
            title='Active Roster'
            space={roster.availableSpace}
            total={activePlayers}
            {...{ percentiles, is_team_manager }}
          />
        </div>
        <div className='league-team-main-section'>
          {Boolean(reserveIRItems.length) && (
            <DashboardPlayersTable
              items={reserveIRItems}
              title='Short Term Reserve'
              space={roster.availableReserveSpace}
              {...{ percentiles, is_team_manager }}
            />
          )}
        </div>
        <div className='league-team-main-section'>
          <DashboardPlayersTable
            items={practice_signed_items}
            title='Practice Squad — Signed'
            space={roster.availablePracticeSpace}
            {...{ percentiles, is_team_manager }}
          />
        </div>
        <div className='league-team-main-section'>
          <DashboardPlayersTable
            items={practice_drafted_items}
            title='Practice Squad — Drafted'
            {...{ percentiles, is_team_manager }}
          />
        </div>
        <div className='league-team-main-section'>
          {Boolean(reserveIRLongTermItems.length) && (
            <DashboardPlayersTable
              items={reserveIRLongTermItems}
              title='Long Term Reserve'
              {...{ percentiles, is_team_manager }}
            />
          )}
        </div>
        <div className='league-team-main-section'>
          {Boolean(reserveCOVItems.length) && (
            <DashboardPlayersTable
              items={reserveCOVItems}
              title='Reserve/COVID-19'
              {...{ percentiles, is_team_manager }}
            />
          )}
        </div>
        <div className='expand league-team-draft-picks'>
          <Toolbar>
            <div className='section-header-title'>Draft Picks</div>
          </Toolbar>
          <DashboardDraftPicks picks={picks} />
        </div>
      </div>
      <div className='league-team-sidebar'>
        {is_hosted_league && <DashboardTeamSummary tid={teamId} />}
        <DashboardTeamValue tid={teamId} />
        <DashboardByeWeeks tid={teamId} />
      </div>
    </div>
  )
}

LeagueTeam.propTypes = {
  league: PropTypes.object,
  load_team_players: PropTypes.func,
  roster: PropTypes.object,
  picks: ImmutablePropTypes.list,
  players: PropTypes.object,
  percentiles: PropTypes.object,
  cutlist: ImmutablePropTypes.list,
  is_team_manager: PropTypes.bool,
  poaches: ImmutablePropTypes.list,
  teams: ImmutablePropTypes.list,
  restricted_free_agency_players: ImmutablePropTypes.list
}
