import Roster from './roster.mjs'
import {
  roster_slot_types,
  starting_lineup_slots,
  fantasy_positions
} from '#constants'
import sum from './sum.mjs'
import get_eligible_slots from './get-eligible-slots.mjs'
import getPlayerCountBySlot from './get-player-count-by-slot.mjs'

// Replacement level for a position is the worst starter AT that position --
// the marginal player a team would have to field there. Only players whose own
// primary_position matches are candidates.
//
// This used to take the last entry of each eligible slot's list and compare
// those, which let a player of a DIFFERENT position set the baseline: a WR
// seated in the superflex slot is in one of QB's eligible slots, and if he
// scores below every starting QB he became the QB baseline. Both flex slots
// have this shape, so it reached every position except DST. The season board
// keys its baseline on the seated player's own position already
// (calculate-distributional-baselines.mjs), so this brings the weekly path onto
// the same definition rather than inventing one.
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
    const slotId = roster_slot_types[slot]
    for (const starter of groupedStarters[slotId]) {
      if (starter.primary_position !== position) continue
      const starter_week_points = (starter.points[week] || {}).total || null
      if (starter_week_points !== null && starter_week_points < minTotal) {
        minTotal = starter_week_points
        selectedPlayer = starter
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
  for (const position of fantasy_positions) {
    grouped[position] = data.filter((p) => p.primary_position === position)
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

    // Move every current starter to the bench BEFORE refilling. The refill used
    // to be nested inside this loop, so bench-and-refill ran once per distinct
    // slot type -- seven times for a league with QB/RB/WR/TE/RBWRTE/QBRBWRTE/DST
    // -- and each pass pushed another set of entries into `starters`.
    for (const slot of Array.from(new Set(eligibleSlots))) {
      const slotStarters = roster.getPlayersBySlot(roster_slot_types[slot])
      for (const p of slotStarters) {
        const player = data.find((ps) => ps.pid === p.pid)
        roster.removePlayer(p.pid)
        roster.addPlayer({
          slot: roster_slot_types.BENCH,
          pid: p.pid,
          pos: player.primary_position
        })
      }
    }

    // set starting lineup with best players on roster
    for (const player of players) {
      const playerEligibleSlots = get_eligible_slots({
        pos: player.primary_position,
        league
      })
      for (const slot of playerEligibleSlots) {
        if (roster.hasOpenSlot(roster_slot_types[slot])) {
          roster.removePlayer(player.pid)
          roster.addPlayer({
            slot: roster_slot_types[slot],
            pid: player.pid,
            pos: player.primary_position
          })
          starters.push({ slot: roster_slot_types[slot], ...player })
          // break, not continue. get_eligible_slots repeats a slot name once
          // per configured slot (srb: 2 yields RB, RB), so continuing re-seated
          // the same player in the next open slot and pushed a duplicate for
          // every one of them. That inflated `starters` to 174 entries over 90
          // league-wide slots for league 1, and the surplus entries dragged
          // getWorseStarterForPosition down onto deep bench players -- a 33.6
          // point QB baseline against a real replacement level near 313.
          break
        }
      }
    }
  }

  // fill remaining roster slots with best available players
  const availablePlayerPool = data.filter(
    (p) =>
      !rostered_pids.includes(p.pid) ||
      !fantasy_positions.includes(p.primary_position)
  )

  const playerCountBySlot = getPlayerCountBySlot({ league })
  const totalStarters = sum(Object.values(playerCountBySlot))

  // Seat each free agent in the FIRST slot he is eligible for that is still
  // open, scanning the dedicated slots across every roster before any flex.
  //
  // The old form scanned roster by roster and took the first open eligible slot
  // on each, which let a player claim a flex on team 1 while his own dedicated
  // slot sat empty on team 2 -- and then a player who could ONLY fill that flex
  // had nowhere to go. On an empty-roster board that left a QB slot unfilled and
  // three players unseated. get_eligible_slots returns dedicated slots before
  // flex ones, so iterating slot-major rather than roster-major is the whole
  // fix: every roster is offered a QB before any roster is offered a superflex.
  //
  // This is the same defect the season path solved with augmenting-path
  // acceptance (calculate-distributional-baselines.mjs). Slot-major ordering is
  // not equivalent to that in general, but it removes the case that actually
  // fires here, where the pool is deep and only the flex slots contend.
  for (const player of availablePlayerPool) {
    if (starters.length >= totalStarters) {
      break
    }

    const eligibleSlots = get_eligible_slots({
      pos: player.primary_position,
      league
    })

    let added = false
    for (const slot of eligibleSlots) {
      for (const roster of rosters) {
        if (!roster.hasOpenSlot(roster_slot_types[slot])) continue
        if (!roster.availableSpace) {
          const benchPlayer = roster.bench[0]
          if (!benchPlayer) continue
          roster.removePlayer(benchPlayer.pid)
        }
        roster.addPlayer({
          slot: roster_slot_types[slot],
          pid: player.pid,
          pos: player.primary_position
        })
        starters.push({ slot: roster_slot_types[slot], ...player })
        added = true
        break
      }

      if (added) break
    }
  }

  // group starters by position
  const groupedStarters = {}
  for (const slot of starting_lineup_slots) {
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
  for (const position of fantasy_positions) {
    groupedRemainingPlayers[position] = remainingPlayers.filter(
      (s) => s.primary_position === position
    )
  }

  // set starter baselines
  const result = {}
  for (const position of fantasy_positions) {
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
