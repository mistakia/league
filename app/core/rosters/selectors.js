import { List, Map } from 'immutable'

import { Roster, constants, isSlotActive } from '@common'
import { getApp } from '@core/app'
import { getPlayerById, getAllPlayers } from '@core/players'
import { getCurrentLeague } from '@core/leagues'
import { getTeamsForCurrentLeague, getTeamById } from '@core/teams'
import { getDraftPickValueByPick } from '@core/draft-pick-value'

import { Roster as RosterRecord } from './roster'

export function getRosters(state) {
  return state.get('rosters')
}

export function getRosterRecordByTeamId(
  state,
  {
    tid,
    week = Math.min(constants.week, constants.season.finalWeek),
    year = constants.year
  }
) {
  const rosters = getRosters(state)
  return rosters.getIn([tid, year, week]) || new RosterRecord()
}

export function getRosterByTeamId(state, { tid, week, year = constants.year }) {
  const rec = getRosterRecordByTeamId(state, { tid, week, year })
  const league = getCurrentLeague(state)
  return new Roster({ roster: rec.toJS(), league })
}

export function getPlayersByTeamId(state, { tid }) {
  const roster = getRosterByTeamId(state, { tid })
  const pids = roster.all.map(({ pid }) => pid)
  return pids.map((pid) => getPlayerById(state, { pid }))
}

export function getStartersByTeamId(state, { tid, week }) {
  const roster = getRosterByTeamId(state, { tid, week })
  return roster.starters.map(({ pid, slot }) => {
    const playerMap = getPlayerById(state, { pid })
    return playerMap.set('slot', slot)
  })
}

export function getActivePlayersByTeamId(
  state,
  { tid, week = constants.week }
) {
  const roster = getRosterByTeamId(state, { tid, week })
  return roster.active.map(({ pid }) => getPlayerById(state, { pid }))
}

export function getRostersForCurrentLeague(state) {
  const rosters = getRosters(state)
  const { leagueId } = getApp(state)
  const week = constants.week
  const year = constants.year
  const filtered = rosters.filter((w) => {
    const r = w.getIn([year, week])
    if (!r) return false
    return r.lid === leagueId
  })

  return filtered.map((r) => r.getIn([year, week]))
}

export function getAvailableSalarySpaceForCurrentLeague(state) {
  const rosters = getRostersForCurrentLeague(state)
  const league = getCurrentLeague(state)
  let available_salary_space = 0
  for (const roster of rosters.valueSeq()) {
    const r = new Roster({ roster: roster.toJS(), league })
    available_salary_space += r.availableCap
  }

  return available_salary_space
}

export function getAvailablePlayersForCurrentLeague(state) {
  const rostered_pids = getRosteredPlayerIdsForCurrentLeague(state)
  const playerMaps = getAllPlayers(state)
  return playerMaps.filter((pMap) => !rostered_pids.includes(pMap.get('pid')))
}

export function getActivePlayersByRosterForCurrentLeague(state) {
  const rosters = getRostersForCurrentLeague(state)
  const league = getCurrentLeague(state)
  let result = new Map()
  for (const ros of rosters.valueSeq()) {
    if (!ros) continue
    const r = new Roster({ roster: ros.toJS(), league })
    const active = r.active.map(({ pid }) => getPlayerById(state, { pid }))
    result = result.set(ros.get('tid'), new List(active))
  }

  return result
}

export function getRosteredPlayerIdsForCurrentLeague(state) {
  const rosters = getRostersForCurrentLeague(state)
  const pids = []
  for (const roster of rosters.values()) {
    roster.players.forEach(({ pid }) => pids.push(pid))
  }
  return new List(pids)
}

export function getRosterInfoForPlayerId(
  state,
  { pid, playerMap = new Map() }
) {
  pid = pid || playerMap.get('pid')
  if (!pid) {
    return {}
  }

  const rosters = getRostersForCurrentLeague(state)
  for (const roster of rosters.values()) {
    for (const rosterPlayer of roster.players) {
      if (rosterPlayer.pid === pid) {
        return { tid: roster.tid, ...rosterPlayer }
      }
    }
  }
  return {}
}

export function getActiveRosterPlayerIdsForCurrentLeague(state) {
  const rosters = getRostersForCurrentLeague(state)
  const pids = []
  for (const roster of rosters.values()) {
    roster.players.forEach(({ slot, pid }) => {
      if (isSlotActive(slot)) {
        pids.push(pid)
      }
    })
  }
  return new List(pids)
}

export function getPracticeSquadPlayerIdsForCurrentLeague(state) {
  const rosters = getRostersForCurrentLeague(state)
  const pids = []
  for (const roster of rosters.values()) {
    roster.players.forEach(({ slot, pid }) => {
      if (constants.ps_slots.includes(slot)) {
        pids.push(pid)
      }
    })
  }
  return new List(pids)
}

export function getInjuredReservePlayerIdsForCurrentLeague(state) {
  const rosters = getRostersForCurrentLeague(state)
  const pids = []
  for (const roster of rosters.values()) {
    roster.players.forEach(({ slot, pid }) => {
      if (slot === constants.slots.IR) {
        pids.push(pid)
      }
    })
  }
  return new List(pids)
}

export function isPlayerFreeAgent(state, { playerMap }) {
  const rostered = getRosteredPlayerIdsForCurrentLeague(state)
  return !rostered.includes(playerMap.get('pid'))
}

export function isPlayerOnPracticeSquad(state, { playerMap }) {
  const practiceSquads = getPracticeSquadPlayerIdsForCurrentLeague(state)
  return practiceSquads.includes(playerMap.get('pid'))
}

export function isPlayerEligible(state, { playerMap, pid }) {
  if (pid) {
    playerMap = getPlayerById(state, { pid })
  }

  if (!playerMap) {
    return false
  }

  const pos = playerMap.get('pos')
  if (!pos) {
    return false
  }

  const roster = getCurrentTeamRosterRecord(state)
  const league = getCurrentLeague(state)
  const ros = new Roster({ roster: roster.toJS(), league })
  return ros.hasOpenBenchSlot(pos)
}

export function getCurrentTeamRosterRecord(state) {
  const rosters = getRosters(state)
  const { teamId } = getApp(state)
  return rosters.getIn(
    [teamId, constants.year, constants.week],
    new RosterRecord()
  )
}

export function getCurrentTeamRoster(state) {
  const league = getCurrentLeague(state)
  const rec = getCurrentTeamRosterRecord(state)
  return new Roster({ roster: rec.toJS(), league })
}

export function getRosterPositionalValueByTeamId(state, { tid }) {
  const rosterRecords = getRostersForCurrentLeague(state)
  const league = getCurrentLeague(state)
  const teams = getTeamsForCurrentLeague(state)
  const team = getTeamById(state, { tid })
  const divTeamIds = teams.filter((t) => t.div === team.div).map((t) => t.uid)

  const values = {
    league_avg: {},
    league: {},
    div_avg: {},
    div: {},
    team: {},
    total: {},
    rosters: {},
    sorted_tids: []
  }

  const rosters = []
  for (const rec of rosterRecords.valueSeq()) {
    const roster = new Roster({ roster: rec.toJS(), league })
    rosters.push(roster)
    values.rosters[roster.tid] = {}
  }

  const seasonType = constants.isOffseason ? '0' : 'ros'
  for (const position of constants.positions) {
    const league = []
    const div = []
    for (const roster of rosters) {
      const rosterPlayers = roster.active.filter((p) => p.pos === position)
      const playerMaps = rosterPlayers.map(({ pid }) =>
        getPlayerById(state, { pid })
      )
      const vorps = playerMaps.map((pMap) =>
        Math.max(pMap.getIn(['vorp', seasonType], 0), 0)
      )
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

  const league_draft_value = []
  const div_draft_value = []
  for (const [tid, team_i] of teams) {
    const draft_value = team_i.picks.reduce(
      (sum, pick) => sum + getDraftPickValueByPick(state, { pick }),
      0
    )
    league_draft_value.push(draft_value)
    if (divTeamIds.includes(tid)) div_draft_value.push(draft_value)
    if (tid === team.uid) {
      values.team.DRAFT = draft_value
    }
    if (values.rosters[tid]) {
      values.rosters[tid].DRAFT = draft_value
      values.total[tid] = values.total[tid] + draft_value
    }
  }

  values.league_avg.DRAFT =
    league_draft_value.reduce((s, i) => s + i, 0) / league_draft_value.length
  values.league.DRAFT = league_draft_value
  values.div_avg.DRAFT =
    div_draft_value.reduce((s, i) => s + i, 0) / div_draft_value.length
  values.div.DRAFT = div_draft_value

  const team_values = Object.entries(values.total).map(([key, value]) => ({
    tid: key,
    value
  }))
  values.sorted_tids = team_values.sort((a, b) => b.value - a.value)
  values.team_total = values.total[team.uid]

  return values
}

export function getGroupedPlayersByTeamId(state, { tid }) {
  const rosters = getRosters(state)
  const league = getCurrentLeague(state)
  const week = Math.min(constants.week, constants.season.finalWeek)
  const roster = rosters.getIn([tid, constants.year, week])
  if (!roster) {
    return {
      active: new List(),
      practice: new List(),
      practice_signed: new List(),
      practice_drafted: new List(),
      ir: new List(),
      cov: new List(),
      players: new List(),
      roster: new Roster({ roster: new RosterRecord().toJS(), league })
    }
  }

  const r = new Roster({ roster: roster.toJS(), league })
  const active = new List(
    r.active.map(({ pid }) => getPlayerById(state, { pid }))
  )
  const practice = new List(
    r.practice.map(({ pid }) => getPlayerById(state, { pid }))
  )
  const practice_signed = new List(
    r.practice_signed.map(({ pid }) => getPlayerById(state, { pid }))
  )
  const practice_drafted = new List(
    r.practice_drafted.map(({ pid }) => getPlayerById(state, { pid }))
  )
  const ir = new List(r.ir.map(({ pid }) => getPlayerById(state, { pid })))
  const cov = new List(r.cov.map(({ pid }) => getPlayerById(state, { pid })))

  const players = active.concat(practice).concat(ir).concat(cov)

  return {
    active,
    practice,
    practice_signed,
    practice_drafted,
    players,
    ir,
    cov,
    roster: r
  }
}

export function getCurrentPlayers(state) {
  const { teamId } = getApp(state)
  return getGroupedPlayersByTeamId(state, { tid: teamId })
}
