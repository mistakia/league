import Roster from './roster.mjs'
import * as constants from './constants.mjs'
import sum from './sum.mjs'
import getEligibleSlots from './get-eligible-slots.mjs'
import getPlayerCountBySlot from './get-player-count-by-slot.mjs'

const getWorseStarterForPosition = ({
  position,
  groupedStarters,
  league,
  week
}) => {
  let minTotal = Infinity
  let selectedPlayer = null

  const eligibleSlots = getEligibleSlots({ pos: position, league })
  for (const slot of eligibleSlots) {
    const slotId = constants.slots[slot]
    const players = groupedStarters[slotId]
    const worst = players[players.length - 1]
    if (worst && worst.points[week].total < minTotal) {
      minTotal = worst.points[week].total
      selectedPlayer = worst
    }
  }

  return selectedPlayer
}

const calculateBaselines = ({ players, rosterRows = [], league, week }) => {
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

  // get starters & optimize starting lineup
  const starters = []
  const eligibleSlots = getEligibleSlots({ pos: 'ALL', league })
  for (const roster of rosters) {
    // get players for roster
    const playerIds = roster.active.map((p) => p.player)
    const players = data.filter((d) => playerIds.includes(d.player))

    // move current starters to bench
    for (const slot of Array.from(new Set(eligibleSlots))) {
      const slotStarters = roster.getPlayersBySlot(constants.slots[slot])
      for (const p of slotStarters) {
        const player = data.find((ps) => ps.player === p.player)
        roster.removePlayer(p.player)
        roster.addPlayer({
          slot: constants.slots.BENCH,
          player: p.player,
          pos: player.pos
        })
      }

      // set starting lineup with best players on roster
      for (const player of players) {
        const eligibleSlots = getEligibleSlots({ pos: player.pos, league })
        for (const slot of eligibleSlots) {
          if (roster.hasOpenSlot(constants.slots[slot])) {
            roster.removePlayer(player.player)
            roster.addPlayer({
              slot: constants.slots[slot],
              player: player.player,
              pos: player.pos
            })
            starters.push({ slot: constants.slots[slot], ...player })
            continue
          }
        }
      }
    }
  }

  // remove rostered players
  const availablePlayerPool = data.filter(
    (p) =>
      !rosteredPlayerIds.includes(p.player) ||
      !constants.positions.includes(p.pos)
  )

  const playerCountBySlot = getPlayerCountBySlot({ league })
  const totalStarters = sum(Object.values(playerCountBySlot))

  for (const player of availablePlayerPool) {
    if (starters.length >= totalStarters) {
      break
    }

    let added = false
    for (const roster of rosters) {
      const eligibleSlots = getEligibleSlots({ pos: player.pos, league })
      for (const slot of eligibleSlots) {
        if (roster.hasOpenSlot(constants.slots[slot])) {
          if (!roster.availableSpace) {
            const benchPlayer = roster.bench[0]
            roster.removePlayer(benchPlayer.player)
          }
          roster.addPlayer({
            slot: constants.slots[slot],
            player: player.player,
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
      .sort((a, b) => b.points[week].total - a.points[week].total)
  }

  // group remaining players by position
  const starterPlayerIds = starters.map((p) => p.player)
  const remainingPlayers = availablePlayerPool.filter(
    (p) => !starterPlayerIds.includes(p.player)
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

    result[position].starter =
      worstStarter || groupedRemainingPlayers[position][0]
  }

  return result
}

export default calculateBaselines
