import Roster from './roster'
import * as constants from './constants'
import getEligibleSlots from './get-eligible-slots'
import getPlayerCountBySlot from './get-player-count-by-slot'

const types = ['available', 'starter']

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

  // reverse order to points ascending
  playerPool = playerPool.reverse()

  const benchBaseline = {}
  for (const position of constants.positions) {
    benchBaseline[position] = playerPool.find((p) => p.pos === position)
  }

  // calculate vorp of remaing player pool
  for (const player of data) {
    player._vorp =
      player.points[week].total -
      (benchBaseline[player.pos]
        ? benchBaseline[player.pos].points[week].total
        : -999999)
  }

  // take the top X based on bench size (exclude all kickers and defense)
  const vorpDesc = data
    .filter((p) => !['DST', 'K'].includes(p.pos))
    .sort((a, b) => b._vorp - a._vorp)
  let benchPool = vorpDesc.splice(0, totalStarters / 2)

  // reset baseline based on bench pool
  benchPool = benchPool.reverse()
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

  // group by position
  const grouped = {}
  for (const position of constants.positions) {
    grouped[position] = data.filter((p) => p.pos === position)
  }

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

  // get starters
  const starters = []
  const eligibleSlots = getEligibleSlots({ pos: 'ALL', league })
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

  // group starters by position
  const result = {}
  const groupedStarters = {}
  for (const position of constants.positions) {
    groupedStarters[position] = starters
      .filter((s) => s.pos === position)
      .sort((a, b) => b.points[week].total - a.points[week].total)
  }

  // remove rostered players
  const availablePlayerPool = data.filter(
    (p) =>
      !rosteredPlayerIds.includes(p.player) ||
      !constants.positions.includes(p.pos)
  )

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
  const isSeasonProjections = week === 0
  for (const position of constants.positions) {
    const players = groupedStarters[position]
    const ws = players[players.length - 1]
    const historicBaseline = league[`b_${position.toLowerCase()}`]

    if (isSeasonProjections && historicBaseline) {
      result[position].historical = grouped[position][historicBaseline]
    } else {
      result[position].historical = defaultBaselines[position]
    }

    result[position].starter = ws || result[position].historical
  }

  return result
}

export default calculateBaselines
