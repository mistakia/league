import Roster from './roster'
import { positions, slots } from './constants'
import getEligibleSlots from './get-eligible-slots'

const types = ['available', 'starter', 'average']

const countOccurrences = (arr, val) =>
  arr.reduce((a, v) => (v === val ? a + 1 : a), 0)
const getBestAvailableForSlot = ({ slot, players, week }) => {
  const eligiblePositions = []
  const grouped = {}
  for (const position of positions) {
    if (slot.includes(position)) eligiblePositions.push(position)
    grouped[position] = players.filter((p) => p.pos === position)
  }

  let combined = []
  for (const pos of eligiblePositions) {
    combined = combined.concat(grouped[pos])
  }

  const sorted = combined.sort(
    (a, b) => b.points[week].total - a.points[week].total
  )
  return sorted[0]
}

const calculateBaselines = ({ players, rosterRows, league, week }) => {
  const data = players.sort(
    (a, b) => b.points[week].total - a.points[week].total
  )

  const rows = []
  for (let i = 0; i < league.nteams; i++) {
    rows.push(rosterRows[i] || { players: [] })
  }

  const rosteredPlayerIds = []
  const rosters = []
  for (const rosterRow of rows) {
    const roster = new Roster({ roster: rosterRow, league })
    roster.players.forEach((p) => rosteredPlayerIds.push(p.player))
    rosters.push(roster)
  }

  // remove rostered players & sort
  let availablePlayerPool = data.filter(
    (p) => !rosteredPlayerIds.includes(p.player) || !positions.includes(p.pos)
  )

  // fill starters using rostered players and suppliment with available players
  const eligibleSlots = getEligibleSlots({ pos: 'ALL', league })
  for (const [index, slot] of eligibleSlots.entries()) {
    for (const roster of rosters) {
      if (roster.isFull) continue
      const limit = countOccurrences(eligibleSlots.slice(0, index + 1), slot)
      const count = roster.getCountBySlot(slot)
      if (count >= limit) continue

      // check bench for player in the top x (occurrences

      // get best available from bench
      const benchIds = roster.bench.map((p) => p.player)
      const benchPlayer = getBestAvailableForSlot({
        slot,
        players: data.filter((d) => benchIds.includes(d.player)),
        week
      })

      const availablePlayer = getBestAvailableForSlot({
        slot,
        players: availablePlayerPool,
        week
      })
      const isBenchBetter =
        benchPlayer &&
        benchPlayer.points[week].total > availablePlayer.points[week].total
      const player = isBenchBetter ? benchPlayer : availablePlayer
      const rosterRow = {
        slot: slots[slot],
        player: player.player,
        pos: player.pos
      }

      if (isBenchBetter) {
        // remove player from bench
        roster.removePlayer(benchPlayer.player)
      }

      const isEligible = roster.isEligibleForSlot(rosterRow)
      if (player && isEligible) {
        roster.addPlayer(rosterRow)
        if (!isBenchBetter) {
          // remove player from available player pool
          availablePlayerPool = availablePlayerPool.filter(
            (p) => p.player !== player.player
          )
        }
      }
    }
  }

  // get starters
  const starters = []
  for (const roster of rosters) {
    // optimize starting lineup
    const playerIds = roster.active.map((p) => p.player)
    let players = data.filter((d) => playerIds.includes(d.player))
    for (const slot of Array.from(new Set(eligibleSlots))) {
      const slotStarters = roster.getPlayersBySlot(slots[slot])

      // move current starters to bench
      for (const p of slotStarters) {
        const player = data.find((ps) => ps.player === p.player)
        roster.removePlayer(p.player)
        roster.addPlayer({
          slot: slots.BENCH,
          player: p.player,
          pos: player.pos
        })
      }

      // set slots with best available
      const count = countOccurrences(eligibleSlots, slot)
      for (let i = 0; i < count; i++) {
        const best = getBestAvailableForSlot({ slot, players, week })
        if (best) {
          roster.removePlayer(best.player)
          roster.addPlayer({
            slot: slots[slot],
            player: best.player,
            pos: best.pos
          })
          players = players.filter((p) => p.player !== best.player)
        }
      }
    }

    roster.starters.forEach((p) => {
      const player = data.find((d) => d.player === p.player)
      starters.push(player)
    })
  }

  // group by position
  const result = {}
  const groupedStarters = {}
  for (const position of positions) {
    groupedStarters[position] = starters
      .filter((s) => s.pos === position)
      .sort((a, b) => b.points[week].total - a.points[week].total)
  }

  const fullRosters = []
  let i = 0
  while (fullRosters.length < league.nteams) {
    const roster = rosters[i]

    if (roster.isFull) {
      fullRosters.push(i)
      continue
    }

    // find an eligible player
    let player
    for (let p = 0; p < availablePlayerPool.length; p++) {
      player = availablePlayerPool[p]
      const isEligible = roster.hasOpenBenchSlot(player.pos)
      if (isEligible) {
        availablePlayerPool.splice(p, 1)
        break
      }
    }

    roster.addPlayer({
      slot: slots.BENCH,
      player: player.player,
      pos: player.pos
    })

    if (i === league.nteams - 1) {
      i = 0
    } else {
      i += 1
    }
  }

  // group availabe players by position
  const groupedAvailablePlayers = {}
  for (const position of positions) {
    groupedAvailablePlayers[position] = availablePlayerPool.filter(
      (s) => s.pos === position
    )
  }

  // get best available baselines
  for (const position of positions) {
    result[position] = {}
    result[position].available = groupedAvailablePlayers[position][0]
  }

  for (const position of positions) {
    // if any baselines are empty - set it to top player at position
    for (const type of types) {
      if (!result[position][type]) {
        result[position][type] = data.find((p) => p.pos === position)
      }
    }
  }

  // set starter baselines
  // uses best available over worst starter when the best available is better
  for (const position of positions) {
    const players = groupedStarters[position]
    const ba = result[position].available
    const ws = players[players.length - 1]
    const avg = players[Math.floor(players.length / 2)]
    result[position].starter =
      ws && ws.points[week].total > ba.points[week].total ? ws : ba
    result[position].average =
      avg && avg.points[week].total > ba.points[week].total ? avg : ba
  }

  return result
}

export default calculateBaselines
