import React, { useEffect } from 'react'
import PropTypes from 'prop-types'
import ImmutablePropTypes from 'react-immutable-proptypes'
import { useParams } from 'react-router-dom'
import { List } from 'immutable'
import Grid from '@mui/material/Grid'
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
    <Grid container spacing={2} alignItems='flex-start'>
      <Grid container item xs={12} lg={9}>
        {Boolean(cutlist.size) && is_team_manager && (
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
              {...{ percentiles, is_team_manager }}
            />
          </Grid>
        )}
        <Grid item xs={12}>
          <DashboardPlayersTable
            items={activeItems}
            title='Active Roster'
            space={roster.availableSpace}
            total={activePlayers}
            {...{ percentiles, is_team_manager }}
          />
        </Grid>
        <Grid item xs={12}>
          <DashboardPlayersTable
            items={practice_signed_items}
            title='Practice Squad — Signed'
            space={roster.availablePracticeSpace}
            {...{ percentiles, is_team_manager }}
          />
        </Grid>
        <Grid item xs={12}>
          <DashboardPlayersTable
            items={practice_drafted_items}
            title='Practice Squad — Drafted'
            {...{ percentiles, is_team_manager }}
          />
        </Grid>
        <Grid item xs={12}>
          {Boolean(reserveIRItems.length) && (
            <DashboardPlayersTable
              items={reserveIRItems}
              title='Reserve/IR'
              space={roster.availableReserveSpace}
              {...{ percentiles, is_team_manager }}
            />
          )}
        </Grid>
        <Grid item xs={12}>
          {Boolean(reserveCOVItems.length) && (
            <DashboardPlayersTable
              items={reserveCOVItems}
              title='Reserve/COVID-19'
              {...{ percentiles, is_team_manager }}
            />
          )}
        </Grid>
        <Grid item md={12} sx={{ display: { xs: 'none', md: 'block' } }}>
          <LeagueTeamValueDeltas tid={teamId} />
        </Grid>
      </Grid>
      <Grid container item xs={12} lg={3}>
        <Grid item xs={12}>
          <div className='section expand'>
            <Toolbar>
              <div className='dashboard__section-header-title'>Draft Picks</div>
            </Toolbar>
            <DashboardDraftPicks picks={picks} />
          </div>
        </Grid>
        {is_hosted_league && (
          <Grid item xs={12}>
            <DashboardTeamSummary tid={teamId} />
          </Grid>
        )}
        <Grid item xs={12}>
          <DashboardByeWeeks tid={teamId} />
        </Grid>
        <Grid item xs={12}>
          <DashboardTeamValue tid={teamId} />
        </Grid>
      </Grid>
    </Grid>
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
