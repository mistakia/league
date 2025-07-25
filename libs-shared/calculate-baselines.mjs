import Roster from './roster.mjs'
import * as constants from './constants.mjs'
import sum from './sum.mjs'
import get_eligible_slots from './get-eligible-slots.mjs'
import getPlayerCountBySlot from './get-player-count-by-slot.mjs'

const getWorseStarterForPosition = ({
  position,
  groupedStarters,
  league,
  week
}) => {
  let minTotal = Infinity
  let selectedPlayer = null

  const eligibleSlots = get_eligible_slots({ pos: position, league })
  for (const slot of eligibleSlots) {
    const slotId = constants.slots[slot]
    const players = groupedStarters[slotId]
    const worst = players[players.length - 1]
    if (worst) {
      const worst_player_week_points = (worst.points[week] || {}).total || null
      if (
        worst_player_week_points !== null &&
        worst_player_week_points < minTotal
      ) {
        minTotal = worst_player_week_points
        selectedPlayer = worst
      }
    }
  }

  return selectedPlayer
}

const calculateBaselines = ({ players, rosterRows = [], league, week }) => {
  const data = players.sort(
    (a, b) => (b.points[week] || {}).total - (a.points[week] || {}).total
  )

  // group by position
  const grouped = {}
  for (const position of constants.positions) {
    grouped[position] = data.filter((p) => p.pos === position)
  }

  const rows = []
  for (let i = 0; i < league.num_teams; i++) {
    rows.push(rosterRows[i] || { players: [] })
  }

  const rostered_pids = []
  const rosters = []
  for (const rosterRow of rows) {
    const roster = new Roster({ roster: rosterRow, league })
    roster.players.forEach((p) => rostered_pids.push(p.pid))
    rosters.push(roster)
  }

  // get starters & optimize starting lineup
  const starters = []
  const eligibleSlots = get_eligible_slots({ pos: 'ALL', league })
  for (const roster of rosters) {
    // get players for roster
    const pids = roster.active.map((p) => p.pid)
    const players = data.filter((d) => pids.includes(d.pid))

    // move current starters to bench
    for (const slot of Array.from(new Set(eligibleSlots))) {
      const slotStarters = roster.getPlayersBySlot(constants.slots[slot])
      for (const p of slotStarters) {
        const player = data.find((ps) => ps.pid === p.pid)
        roster.removePlayer(p.pid)
        roster.addPlayer({
          slot: constants.slots.BENCH,
          pid: p.pid,
          pos: player.pos
        })
      }

      // set starting lineup with best players on roster
      for (const player of players) {
        const eligibleSlots = get_eligible_slots({ pos: player.pos, league })
        for (const slot of eligibleSlots) {
          if (roster.hasOpenSlot(constants.slots[slot])) {
            roster.removePlayer(player.pid)
            roster.addPlayer({
              slot: constants.slots[slot],
              pid: player.pid,
              pos: player.pos
            })
            starters.push({ slot: constants.slots[slot], ...player })
            continue
          }
        }
      }
    }
  }

  // fill remaining roster slots with best available players
  const availablePlayerPool = data.filter(
    (p) =>
      !rostered_pids.includes(p.pid) || !constants.positions.includes(p.pos)
  )

  const playerCountBySlot = getPlayerCountBySlot({ league })
  const totalStarters = sum(Object.values(playerCountBySlot))

  for (const player of availablePlayerPool) {
    if (starters.length >= totalStarters) {
      break
    }

    let added = false
    for (const roster of rosters) {
      const eligibleSlots = get_eligible_slots({ pos: player.pos, league })
      for (const slot of eligibleSlots) {
        if (roster.hasOpenSlot(constants.slots[slot])) {
          if (!roster.availableSpace) {
            const benchPlayer = roster.bench[0]
            roster.removePlayer(benchPlayer.pid)
          }
          roster.addPlayer({
            slot: constants.slots[slot],
            pid: player.pid,
            pos: player.pos
          })
          starters.push({ slot: constants.slots[slot], ...player })
          added = true
          break
        }
      }

      if (added) break
    }
  }

  // group starters by position
  const groupedStarters = {}
  for (const slot of constants.starterSlots) {
    groupedStarters[slot] = starters
      .filter((s) => s.slot === slot)
      .sort(
        (a, b) => (b.points[week] || {}).total - (a.points[week] || {}).total
      )
  }

  // group remaining players by position
  const starter_pids = starters.map((p) => p.pid)
  const remainingPlayers = availablePlayerPool.filter(
    (p) => !starter_pids.includes(p.pid)
  )
  const groupedRemainingPlayers = {}
  for (const position of constants.positions) {
    groupedRemainingPlayers[position] = remainingPlayers.filter(
      (s) => s.pos === position
    )
  }

  // set starter baselines
  const result = {}
  for (const position of constants.positions) {
    result[position] = {}
    const worstStarter = getWorseStarterForPosition({
      position,
      groupedStarters,
      league,
      week
    })

    result[position].available = groupedRemainingPlayers[position][0]

    result[position].starter =
      worstStarter || groupedRemainingPlayers[position][0]
  }

  return result
}

export default calculateBaselines
