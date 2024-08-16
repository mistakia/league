import React, { useEffect } from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import { useParams } from 'react-router-dom'
import { List } from 'immutable'
import Toolbar from '@mui/material/Toolbar'
import NotInterestedIcon from '@mui/icons-material/NotInterested'

import DashboardDraftPicks from '@components/dashboard-draft-picks'
import DashboardByeWeeks from '@components/dashboard-bye-weeks'
import DashboardPlayersTable from '@components/dashboard-players-table'
import DashboardTeamSummary from '@components/dashboard-team-summary'
import DashboardTeamValue from '@components/dashboard-team-value'
import PlayerRoster from '@components/player-roster'
import { constants } from '@libs-shared'
import LeagueTeamValueDeltas from '@components/league-team-value-deltas'

import './league-team.styl'

export default function LeagueTeam({
  league,
  loadTeamPlayers,
  roster,
  picks,
  players,
  percentiles,
  cutlist,
  is_team_manager
}) {
  const { lid, tid } = useParams()

  const is_hosted_league = Boolean(league.hosted)
  const teamId = Number(tid)

  useEffect(() => {
    loadTeamPlayers({
      leagueId: Number(lid),
      teamId
    })
  }, [tid, lid, loadTeamPlayers, teamId])

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
      if (!playerMap.get('pid')) continue
      if (
        !constants.isRegularSeason &&
        cutlist_pids.includes(playerMap.get('pid'))
      )
        continue

      activePlayers = activePlayers.push(playerMap)
      activeItems.push(
        <PlayerRoster
          key={playerMap.get('pid')}
          {...{ playerMap, percentiles, is_team_manager }}
        />
      )
    }
  }

  const practice_signed_items = []
  for (const playerMap of players.practice_signed) {
    if (!playerMap.get('pid')) continue
    practice_signed_items.push(
      <PlayerRoster
        key={playerMap.get('pid')}
        {...{ playerMap, percentiles }}
      />
    )
  }

  const practice_drafted_items = []
  for (const playerMap of players.practice_drafted) {
    if (!playerMap.get('pid')) continue
    practice_drafted_items.push(
      <PlayerRoster
        key={playerMap.get('pid')}
        {...{ playerMap, percentiles }}
      />
    )
  }

  const reserveIRItems = []
  for (const playerMap of players.ir) {
    if (!playerMap.get('pid')) continue
    reserveIRItems.push(
      <PlayerRoster
        key={playerMap.get('pid')}
        {...{ playerMap, percentiles }}
      />
    )
  }

  const reserveCOVItems = []
  for (const playerMap of players.cov) {
    if (!playerMap.get('pid')) continue
    reserveCOVItems.push(
      <PlayerRoster
        key={playerMap.get('pid')}
        {...{ playerMap, percentiles }}
      />
    )
  }

  return (
    <div className='league-team-container'>
      <div className='league-team-main'>
        <div className='league-team-main-section'>
          <LeagueTeamValueDeltas tid={teamId} />
        </div>
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
  loadTeamPlayers: PropTypes.func,
  roster: PropTypes.object,
  picks: ImmutablePropTypes.list,
  players: PropTypes.object,
  percentiles: PropTypes.object,
  cutlist: ImmutablePropTypes.list,
  is_team_manager: PropTypes.bool
}
