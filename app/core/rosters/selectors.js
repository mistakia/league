import { List, Map } from 'immutable'

import { Roster, constants, isSlotActive } from '@common'
import { getApp } from '@core/app'
import { getPlayerById, getAllPlayers } from '@core/players'
import { getCurrentLeague } from '@core/leagues'
import { getTeamsForCurrentLeague, getCurrentTeam } from '@core/teams'

import { Roster as RosterRecord } from './roster'

export function getRosters(state) {
  return state.get('rosters')
}

export function getRosterRecordByTeamId(
  state,
  { tid, week = Math.min(constants.season.week, constants.season.finalWeek) }
) {
  const rosters = getRosters(state)
  return rosters.getIn([tid, week]) || new RosterRecord()
}

export function getRosterByTeamId(state, { tid, week }) {
  const rec = getRosterRecordByTeamId(state, { tid, week })
  const league = getCurrentLeague(state)
  return new Roster({ roster: rec.toJS(), league })
}

export function getPlayersByTeamId(state, { tid }) {
  const roster = getRosterByTeamId(state, { tid })
  const playerIds = roster.all.map((p) => p.player)
  return playerIds.map((playerId) => getPlayerById(state, { playerId }))
}

export function getStartersByTeamId(state, { tid, week }) {
  const roster = getRosterByTeamId(state, { tid, week })
  return roster.starters.map((p) => {
    const player = getPlayerById(state, { playerId: p.player })
    return player.set('slot', p.slot)
  })
}

export function getActivePlayersByTeamId(
  state,
  { tid, week = Math.min(constants.season.week, constants.season.finalWeek) }
) {
  const roster = getRosterByTeamId(state, { tid, week })
  const activePlayerIds = roster.active.map((p) => p.player)
  return activePlayerIds.map((playerId) => getPlayerById(state, { playerId }))
}

export function getRostersForCurrentLeague(state) {
  const rosters = getRosters(state)
  const { leagueId } = getApp(state)
  const week = Math.min(constants.season.week, constants.season.finalWeek)
  const filtered = rosters.filter((w) => {
    const r = w.get(week)
    if (!r) return false
    return r.lid === leagueId
  })

  return filtered.map((r) => r.get(week))
}

export function getAvailablePlayersForCurrentLeague(state) {
  const rosteredPlayerIds = getRosteredPlayerIdsForCurrentLeague(state)
  const all = getAllPlayers(state)
  return all.filter((p) => !rosteredPlayerIds.includes(p.player))
}

export function getActivePlayersByRosterForCurrentLeague(state) {
  const rosters = getRostersForCurrentLeague(state)
  const league = getCurrentLeague(state)
  let result = new Map()
  for (const ros of rosters.valueSeq()) {
    if (!ros) continue
    const r = new Roster({ roster: ros.toJS(), league })
    const activePlayerIds = r.active.map((p) => p.player)
    const active = activePlayerIds.map((playerId) =>
      getPlayerById(state, { playerId })
    )
    result = result.set(ros.get('tid'), new List(active))
  }

  return result
}

export function getRosteredPlayerIdsForCurrentLeague(state) {
  const rosters = getRostersForCurrentLeague(state)
  const players = []
  for (const roster of rosters.values()) {
    roster.players.forEach((p) => players.push(p.player))
  }
  return new List(players)
}

export function getRosterInfoForPlayerId(state, { playerId, player }) {
  const pid = playerId || player.player
  if (!pid) {
    return {}
  }

  const rosters = getRostersForCurrentLeague(state)
  for (const roster of rosters.values()) {
    for (const rosterPlayer of roster.players) {
      if (rosterPlayer.player === pid) {
        return rosterPlayer
      }
    }
  }
  return {}
}

export function getActiveRosterPlayerIdsForCurrentLeague(state) {
  const rosters = getRostersForCurrentLeague(state)
  const players = []
  for (const roster of rosters.values()) {
    roster.players.forEach((p) => {
      if (isSlotActive(p.slot)) {
        players.push(p.player)
      }
    })
  }
  return new List(players)
}

export function getPracticeSquadPlayerIdsForCurrentLeague(state) {
  const rosters = getRostersForCurrentLeague(state)
  const players = []
  for (const roster of rosters.values()) {
    roster.players.forEach((p) => {
      if (p.slot === constants.slots.PS || p.slot === constants.slots.PSP) {
        players.push(p.player)
      }
    })
  }
  return new List(players)
}

export function getInjuredReservePlayerIdsForCurrentLeague(state) {
  const rosters = getRostersForCurrentLeague(state)
  const players = []
  for (const roster of rosters.values()) {
    roster.players.forEach((p) => {
      if (p.slot === constants.slots.IR) {
        players.push(p.player)
      }
    })
  }
  return new List(players)
}

export function isPlayerFreeAgent(state, { player }) {
  const rostered = getRosteredPlayerIdsForCurrentLeague(state)
  return !rostered.includes(player.player)
}

export function isPlayerOnPracticeSquad(state, { player }) {
  const practiceSquads = getPracticeSquadPlayerIdsForCurrentLeague(state)
  return practiceSquads.includes(player.player)
}

export function isPlayerEligible(state, { player, playerId }) {
  if (playerId) {
    player = getPlayerById(state, { playerId })
  }

  if (!player) {
    return false
  }

  if (!player.pos) {
    return false
  }

  const roster = getCurrentTeamRosterRecord(state)
  const league = getCurrentLeague(state)
  const ros = new Roster({ roster: roster.toJS(), league })
  return ros.hasOpenBenchSlot(player.pos)
}

export function getCurrentTeamRosterRecord(state) {
  const rosters = getRosters(state)
  const { teamId } = getApp(state)
  const week = Math.min(constants.season.week, constants.season.finalWeek)
  return rosters.getIn([teamId, week], new RosterRecord())
}

export function getCurrentTeamRoster(state) {
  const league = getCurrentLeague(state)
  const rec = getCurrentTeamRosterRecord(state)
  return new Roster({ roster: rec.toJS(), league })
}

export function getCurrentTeamRosterPositionalValue(state) {
  const rosterRecords = getRostersForCurrentLeague(state)
  const league = getCurrentLeague(state)
  const teams = getTeamsForCurrentLeague(state)
  const team = getCurrentTeam(state)
  const divTeamIds = teams.filter((t) => t.div === team.div).map((t) => t.uid)

  const values = {
    league_avg: {},
    league: {},
    div_avg: {},
    div: {},
    team: {},
    total: {},
    rosters: {}
  }

  const rosters = []
  for (const rec of rosterRecords.valueSeq()) {
    const roster = new Roster({ roster: rec.toJS(), league })
    rosters.push(roster)
    values.rosters[roster.tid] = {}
  }

  const seasonType = constants.season.isOffSeason ? '0' : 'ros'
  for (const position of constants.positions) {
    const league = []
    const div = []
    for (const roster of rosters) {
      const rosterPlayers = roster.active.filter((p) => p.pos === position)
      const players = rosterPlayers.map((p) =>
        getPlayerById(state, { playerId: p.player })
      )
      const vorps = players.map((p) => p.getIn(['vorp', seasonType], 0))
      const sum = vorps.reduce((s, i) => s + i, 0)
      league.push(sum)
      values.rosters[roster.tid][position] = sum
      if (divTeamIds.includes(roster.tid)) div.push(sum)
      if (roster.tid === team.uid) values.team[position] = sum
      values.total[roster.tid] = (values.total[roster.tid] ?? 0) + sum
    }
    values.league_avg[position] =
      league.reduce((s, i) => s + i, 0) / league.length
    values.league[position] = league
    values.div_avg[position] = div.reduce((s, i) => s + i, 0) / div.length
    values.div[position] = div
  }

  values.team_total = values.total[team.uid]

  return values
}

export function getCurrentPlayers(state) {
  const rosters = getRosters(state)
  const { teamId, leagueId } = getApp(state)
  const league = state.get('leagues').get(leagueId)
  const week = Math.min(constants.season.week, constants.season.finalWeek)
  const roster = rosters.getIn([teamId, week])
  if (!roster) {
    return {
      active: new List(),
      practice: new List(),
      ir: new List(),
      cov: new List(),
      players: new List(),
      roster: new Roster({ roster: new RosterRecord().toJS(), league })
    }
  }

  const r = new Roster({ roster: roster.toJS(), league })
  const activePlayerIds = r.active.map((p) => p.player)
  const active = new List(
    activePlayerIds.map((playerId) => getPlayerById(state, { playerId }))
  )
  const practicePlayerIds = r.practice.map((p) => p.player)
  const practice = new List(
    practicePlayerIds.map((playerId) => getPlayerById(state, { playerId }))
  )

  const reserveIRPlayerIds = r.ir.map((p) => p.player)
  const ir = new List(
    reserveIRPlayerIds.map((playerId) => getPlayerById(state, { playerId }))
  )
  const reserveCOVPlayerIds = r.cov.map((p) => p.player)
  const cov = new List(
    reserveCOVPlayerIds.map((playerId) => getPlayerById(state, { playerId }))
  )

  const players = active.concat(practice).concat(ir).concat(cov)

  return { active, practice, players, ir, cov, roster: r }
}
