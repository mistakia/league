import Roster from './roster'
import * as constants from './constants'
import getEligibleSlots from './get-eligible-slots'
import getPlayerCountBySlot from './get-player-count-by-slot'

const types = ['available', 'starter', 'average']

const countOccurrences = (arr, val) =>
  arr.reduce((a, v) => (v === val ? a + 1 : a), 0)
const getBestAvailableForSlot = ({ slot, players, week }) => {
  const eligiblePositions = []
  const grouped = {}
  for (const position of constants.positions) {
    if (slot.includes(position)) eligiblePositions.push(position)
    grouped[position] = players.filter((p) => p.pos === position)
  }

  let combined = []
  for (const pos of eligiblePositions) {
    combined = combined.concat(grouped[pos])
  }

  const sorted = combined.sort(
    (a, b) => b.points[week].total - a.points[week].total || b.player - a.player
  )
  return sorted[0]
}

// expect players to be sorted by points descending
const getDefaultBaselines = ({ players, league, week }) => {
  const data = JSON.parse(JSON.stringify(players))
  const playerCount = getPlayerCountBySlot({ league })
  let playerPool = []

  // fill player pool based on number of starting slots
  const starterSlotNames = Object.keys(constants.slots).filter((slotName) =>
    constants.starterSlots.includes(constants.slots[slotName])
  )
  const totalStarters = starterSlotNames.reduce(
    (accum, item) => accum + playerCount[item],
    0
  )
  for (const slotName of starterSlotNames) {
    if (playerCount[slotName]) {
      const pool = []
      while (pool.length < playerCount[slotName]) {
        const idx = data.findIndex((p) => slotName.includes(p.pos))
        const player = data.splice(idx, 1)
        if (player.length) pool.push(player[0])
      }
      playerPool = playerPool.concat(pool)
    }
  }

  const benchBaseline = {}
  for (const position of constants.positions) {
    const player = data
      .filter((p) => p.pos === position)
      .splice(0, Math.round(league.nteams * 1))
      .pop()
    benchBaseline[position] = player
  }

  // calculate vorp of remaing player pool
  for (const player of data) {
    player._vorp =
      player.points[week].total - (benchBaseline[player.pos] ? benchBaseline[player.pos].points[week].total : 0)
  }

  // take the top X based on bench size (exclude all kickers and defense)
  const vorpDesc = data
    .filter((p) => !['DST', 'K'].includes(p.pos))
    .sort((a, b) => b._vorp - a._vorp)
  let benchPool = vorpDesc.splice(0, totalStarters / 2)

  // reset baseline based on bench pool
  benchPool = benchPool.reverse()
  playerPool = playerPool.reverse()
  const result = {}
  for (const position of constants.positions) {
    const startPoolPlayer = playerPool.find((p) => p.pos === position)
    const benchPoolPlayer = benchPool.find((p) => p.pos === position)
    result[position] = benchPoolPlayer || startPoolPlayer
  }

  return result
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
    (p) =>
      !rosteredPlayerIds.includes(p.player) ||
      !constants.positions.includes(p.pos)
  )

  // fill starters using rostered players and suppliment with available players
  const eligibleSlots = getEligibleSlots({ pos: 'ALL', league })
  for (const [index, slot] of eligibleSlots.entries()) {
    const remainingSlots = eligibleSlots.slice(0, index + 1)
    for (const roster of rosters) {
      if (roster.isFull) continue
      const limit = countOccurrences(remainingSlots, slot)
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
        slot: constants.slots[slot],
        player: player.player,
        pos: player.pos
      }

      const isEligible = roster.isEligibleForSlot(rosterRow)
      if (player && isEligible) {
        if (isBenchBetter) {
          // remove player from bench
          roster.removePlayer(benchPlayer.player)
        } else {
          // remove player from available player pool
          availablePlayerPool = availablePlayerPool.filter(
            (p) => p.player !== player.player
          )
        }

        roster.addPlayer(rosterRow)
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
      const slotStarters = roster.getPlayersBySlot(constants.slots[slot])

      // move current starters to bench
      for (const p of slotStarters) {
        const player = data.find((ps) => ps.player === p.player)
        roster.removePlayer(p.player)
        roster.addPlayer({
          slot: constants.slots.BENCH,
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
            slot: constants.slots[slot],
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
  for (const position of constants.positions) {
    groupedStarters[position] = starters
      .filter((s) => s.pos === position)
      .sort((a, b) => b.points[week].total - a.points[week].total)
  }

  // fill rosters
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
      slot: constants.slots.BENCH,
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
  for (const position of constants.positions) {
    groupedAvailablePlayers[position] = availablePlayerPool.filter(
      (s) => s.pos === position
    )
  }

  // get best available baselines
  for (const position of constants.positions) {
    result[position] = {}
    result[position].available = groupedAvailablePlayers[position][0]
  }

  for (const position of constants.positions) {
    // if any baselines are empty - set it to top player at position
    for (const type of types) {
      if (!result[position][type]) {
        result[position][type] = data.find((p) => p.pos === position)
      }
    }
  }

  // set starter baselines
  // uses best available over worst starter when the best available is better
  const defaultBaselines = getDefaultBaselines({ players, week, league })
  for (const position of constants.positions) {
    const players = groupedStarters[position]
    // const ba = result[position].available
    const ws = players[players.length - 1]
    const avg = players[Math.floor(players.length / 2)]
    result[position].starter = ws
    result[position].average = avg
    result[position].defaultAvailable = defaultBaselines[position]
  }

  return result
}

export default calculateBaselines
