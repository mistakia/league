import React, { useEffect, useMemo } from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import { useParams } from 'react-router-dom'
import { List } from 'immutable'
import Toolbar from '@mui/material/Toolbar'
import NotInterestedIcon from '@mui/icons-material/NotInterested'
import Alert from '@mui/material/Alert'

import DashboardDraftPicks from '@components/dashboard-draft-picks'
import DashboardByeWeeks from '@components/dashboard-bye-weeks'
import DashboardPlayersTable from '@components/dashboard-players-table'
import DashboardTeamSummary from '@components/dashboard-team-summary'
import DashboardTeamValue from '@components/dashboard-team-value'
import PoachNotice from '@components/poach-notice'
import PlayerRoster from '@components/player-roster'
import {
  constants,
  isReserveEligible,
  isReserveCovEligible
} from '@libs-shared'
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

  const is_hosted_league = Boolean(league.hosted)
  const teamId = Number(tid)

  useEffect(() => {
    load_team_players({
      leagueId: Number(lid),
      teamId
    })
  }, [tid, lid, load_team_players, teamId])

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
    for (const player_map of players) {
      if (!player_map.get('pid')) continue
      if (
        !constants.isRegularSeason &&
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

  const practice_drafted_items = []
  for (const player_map of players.practice_drafted) {
    if (!player_map.get('pid')) continue
    practice_drafted_items.push(
      <PlayerRoster
        key={player_map.get('pid')}
        {...{ player_map, percentiles }}
      />
    )
  }

  const reserveIRItems = []
  for (const player_map of players.ir) {
    if (!player_map.get('pid')) continue
    reserveIRItems.push(
      <PlayerRoster
        key={player_map.get('pid')}
        {...{ player_map, percentiles }}
      />
    )
  }

  const reserveIRLongTermItems = []
  for (const player_map of players.ir_long_term) {
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
  for (const player_map of [...players.ir, ...players.ir_long_term]) {
    if (!player_map.get('pid')) continue

    if (
      !isReserveEligible({
        nfl_status: player_map.get('nfl_status'),
        injury_status: player_map.get('injury_status')
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
          {Boolean(reserveIRItems.length) && (
            <DashboardPlayersTable
              items={reserveIRItems}
              title='Reserve/IR'
              space={roster.availableReserveSpace}
              {...{ percentiles, is_team_manager }}
            />
          )}
        </div>
        <div className='league-team-main-section'>
          {Boolean(reserveIRLongTermItems.length) && (
            <DashboardPlayersTable
              items={reserveIRLongTermItems}
              title='Reserve/IR (Long Term)'
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
