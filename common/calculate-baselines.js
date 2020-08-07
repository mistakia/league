import Roster from './roster'
import { positions, slots } from './constants'
import getEligibleSlots from './get-eligible-slots'

const countOccurrences = (arr, val) => arr.reduce((a, v) => (v === val ? a + 1 : a), 0)
const getBestAvailableForSlot = ({ slot, players }) => {
  const eligiblePositions = []
  const grouped = {}
  for (const position of positions) {
    if (slot.includes(position)) eligiblePositions.push(position)
    grouped[position] = players.filter(p => p.pos1 === position)
  }

  let combined = []
  for (const pos of eligiblePositions) {
    combined = combined.concat(grouped[pos])
  }

  const sorted = combined.sort((a, b) => b.points.total - a.points.total)
  return sorted[0]
}

const calculateBaselines = ({
  players,
  rosterRows,
  league
}) => {
  const data = JSON.parse(JSON.stringify(players))

  const rows = []
  for (let i = 0; i < league.nteams; i++) {
    rows.push(rosterRows[i] || { players: [] })
  }

  const rosteredPlayerIds = []
  const rosters = []
  for (const rosterRow of rows) {
    const roster = new Roster({ roster: rosterRow, league })
    roster.players.forEach(p => rosteredPlayerIds.push(p.player))
    rosters.push(roster)
  }

  // remove rostered players & sort
  let availablePlayerPool = data
    .filter(p => !rosteredPlayerIds.includes(p.player) || !positions.includes(p.pos1))
    .sort((a, b) => b.points.total - a.points.total)

  // fill starters using rostered players and suppliment with available players
  const eligibleSlots = getEligibleSlots({ pos: 'ALL', league })
  for (const [index, slot] of eligibleSlots.entries()) {
    for (const roster of rosters) {
      const limit = countOccurrences(eligibleSlots.slice(0, index + 1), slot)
      const count = roster.getCountBySlot(slot)
      if (count >= limit) continue

      // get best available from bench
      const benchIds = roster.bench.map(p => p.player)
      let player = getBestAvailableForSlot({
        slot,
        players: data.filter(d => benchIds.includes(d.player))
      })

      if (player) {
        // remove player from bench
        roster.removePlayer(player.player)
      } else {
        // if no players available from bench, get best available from pool
        player = getBestAvailableForSlot({ slot, players: availablePlayerPool })
        if (player) {
          // remove player from available player pool
          availablePlayerPool = availablePlayerPool.filter(p => p.player !== player.player)
        }
      }

      const rosterRow = {
        slot: slots[slot],
        player: player.player,
        pos: player.pos1
      }
      const isEligible = roster.isEligibleForSlot(rosterRow)
      if (player && isEligible && !roster.isFull) {
        roster.addPlayer(rosterRow)
      }
    }
  }

  // get starters
  const starters = []
  for (const roster of rosters) {
    roster.starters.forEach(p => {
      const player = data.find(d => d.player === p.player)
      starters.push(player)
    })
  }

  // group by position
  const groupedStarters = {}
  for (const position of positions) {
    groupedStarters[position] = starters
      .filter(s => s.pos1 === position)
      .sort((a, b) => b.points.total - a.points.total)
  }

  const result = {}
  for (const position of positions) {
    const players = groupedStarters[position]
    result[position] = {}
    result[position].starter = players[players.length - 1]
    result[position].average = players[Math.floor(players.length / 2)]
  }

  // sort by starter vor
  const vorAvailablePlayers = availablePlayerPool.map(p => ({
    _value: ['K', 'DST'].includes(p.pos1)
      ? 99999
      : Math.round(Math.abs(result[p.pos1].starter.points.total - p.points.total) / result[p.pos1].starter.points.total) ,
    ...p
  }))
  const sortedAvailablePlayers = vorAvailablePlayers.sort((a, b) => a._value - b._value)

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
    for (let p = 0; p < sortedAvailablePlayers.length; p++) {
      player = sortedAvailablePlayers[p]
      const isEligible = roster.hasOpenBenchSlot(player.pos1)
      if (isEligible) {
        sortedAvailablePlayers.splice(p, 1)
        break
      }
    }

    roster.addPlayer({
      slot: slots.BENCH,
      player: player.player,
      pos: player.pos1
    })

    if (i === (league.nteams - 1)) {
      i = 0
    } else {
      i += 1
    }
  }

  // group availabe players by position
  const groupedAvailablePlayers = {}
  for (const position of positions) {
    const players = sortedAvailablePlayers.filter(s => s.pos1 === position)
    groupedAvailablePlayers[position] = players.sort((a, b) => b.points.total - a.points.total)
  }

  // get best available baselines
  for (const position of positions) {
    result[position].available = groupedAvailablePlayers[position][0]
  }

  return result
}

export default calculateBaselines
