import { fantasy_positions } from '#constants'
import get_eligible_slots from './get-eligible-slots.mjs'

// Replacement level and surplus, both as expectations over drawn seasons.
//
// The shipped model reads replacement level off the point-estimate board: rank
// the consensus, fill the starting slots, take the worst starter. Two errors
// follow, and they compound.
//
//   payoff    A roster spot is worth E[max(X - baseline, 0)] -- a bust gets
//             benched, so the downside truncates at replacement. Evaluating
//             max(E[X] - baseline, 0) instead understates every player, and
//             understates most where dispersion is largest.
//
//   baseline  Outcomes fan out around projections, so a position's top rises
//             above its board and its tail falls below. Reading replacement off
//             point estimates therefore sets it too HIGH on a shallow,
//             high-dispersion position and too low on deep ones. Measured over
//             2020-2025 that put QB replacement above where it landed every
//             season while RB, WR and TE all sat below.
//
// Drawing fixes both at once, and fixes them consistently: the baseline and the
// curve are averages over the SAME draws, so they agree by construction rather
// than through a fitted transform.
//
// This is the league in a vacuum. Slots come from the league's configuration
// and the pool is every projected player, with no roster ownership -- the
// question is what replacement costs in an open market, not what one rival's
// thin roster forces him to start. The roster-aware question is a different one
// and belongs to the `available` baseline.

const default_random = () => Math.random()

// Box-Muller, caching the second deviate. Takes an injectable uniform source so
// specs can pin the draws.
const make_normal_source = (random) => {
  let spare = null
  return () => {
    if (spare !== null) {
      const value = spare
      spare = null
      return value
    }
    let u = 0
    let v = 0
    let s = 0
    do {
      u = random() * 2 - 1
      v = random() * 2 - 1
      s = u * u + v * v
    } while (s === 0 || s >= 1)
    const factor = Math.sqrt((-2 * Math.log(s)) / s)
    spare = v * factor
    return u * factor
  }
}

// A slot accepts a position when its name contains that position's code, which
// is how get_eligible_slots already encodes eligibility (RBWRTE takes RB, WR
// and TE; QBRBWRTE additionally takes QB).
const slot_accepts = (slot, position) => slot.includes(position)

// Every starting slot in the league: one team's configured slots repeated per
// team. Bench, practice squad and reserve are excluded -- they do not bear on
// replacement level.
export const build_league_starting_slots = ({ league }) => {
  const per_team = get_eligible_slots({ pos: 'ALL', league })
  const slots = []
  for (let team = 0; team < league.num_teams; team++) {
    for (const slot of per_team) {
      if (fantasy_positions.some((position) => slot_accepts(slot, position))) {
        slots.push(slot)
      }
    }
  }
  return slots
}

// Fill the starting slots to maximize total points.
//
// Players and slots form a bipartite graph, so the fillable player sets are the
// independent sets of a TRANSVERSAL MATROID. Greedy in descending value is
// therefore optimal, provided acceptance is tested by whether an augmenting
// path exists rather than by whether some eligible slot happens to be free --
// a player may be seatable only after displacing an earlier one into a
// different slot. Verified against an independent transportation LP over the
// same structure: identical objective and identical per-position baseline on
// every draw tested.
export const fill_starting_slots = ({ values, positions, slots }) => {
  const slot_owner = new Array(slots.length).fill(-1)
  const visited = new Array(slots.length)

  const try_augment = (player_index) => {
    for (let slot = 0; slot < slots.length; slot++) {
      if (visited[slot]) continue
      if (!slot_accepts(slots[slot], positions[player_index])) continue
      visited[slot] = true
      if (slot_owner[slot] === -1 || try_augment(slot_owner[slot])) {
        slot_owner[slot] = player_index
        return true
      }
    }
    return false
  }

  const order = values
    .map((_, index) => index)
    .sort((a, b) => values[b] - values[a])

  let seated = 0
  const baseline = {}
  for (const player_index of order) {
    if (seated >= slots.length) break
    visited.fill(false)
    if (!try_augment(player_index)) continue
    seated++
    const position = positions[player_index]
    // Players arrive in descending value, so the last one seated at a position
    // is that position's worst starter.
    baseline[position] = values[player_index]
  }

  return baseline
}

// players: [{ pid, primary_position, points: { [week]: { total, points_sd } } }]
//
// Returns expected replacement points per position, expected floored surplus
// per player, and their total -- the denominator calculate-prices divides the
// discretionary cap by.
const calculate_distributional_baselines = ({
  players,
  league,
  week,
  draws = 1000,
  random = default_random
}) => {
  const slots = build_league_starting_slots({ league })
  const normal = make_normal_source(random)

  const pids = []
  const positions = []
  const means = []
  const dispersions = []
  for (const player of players) {
    const position = player.primary_position
    if (!fantasy_positions.includes(position)) continue
    if (!slots.some((slot) => slot_accepts(slot, position))) continue
    const week_points = player.points && player.points[week]
    const total = week_points ? Number(week_points.total) : null
    if (!(total > 0)) continue
    pids.push(player.pid)
    positions.push(position)
    means.push(total)
    dispersions.push(Math.max(Number(week_points.points_sd) || 0, 0))
  }

  const baseline_totals = {}
  const surplus_totals = {}
  for (const position of fantasy_positions) baseline_totals[position] = 0
  for (const pid of pids) surplus_totals[pid] = 0

  const baseline_draw_counts = {}
  const values = new Array(means.length)

  for (let draw = 0; draw < draws; draw++) {
    for (let i = 0; i < means.length; i++) {
      // Points cannot go negative, so the draw is floored rather than allowed
      // to wrap into a negative season.
      values[i] =
        dispersions[i] > 0
          ? Math.max(means[i] + dispersions[i] * normal(), 0)
          : means[i]
    }

    const baseline = fill_starting_slots({ values, positions, slots })

    for (const position of Object.keys(baseline)) {
      baseline_totals[position] += baseline[position]
      baseline_draw_counts[position] = (baseline_draw_counts[position] || 0) + 1
    }

    for (let i = 0; i < values.length; i++) {
      const replacement = baseline[positions[i]]
      if (replacement === undefined) continue
      if (values[i] > replacement) {
        surplus_totals[pids[i]] += values[i] - replacement
      }
    }
  }

  // Average a position's baseline over the draws in which it was actually
  // filled. Dividing by `draws` would silently pull a position that cannot fill
  // its slots -- a league with no DST-eligible players projected, say -- toward
  // zero and make every one of its players look enormously valuable.
  const baselines = {}
  for (const position of fantasy_positions) {
    const filled = baseline_draw_counts[position] || 0
    baselines[position] = filled ? baseline_totals[position] / filled : null
  }

  const expected_surplus = {}
  let total_pts_added = 0
  for (const pid of pids) {
    const expected = surplus_totals[pid] / draws
    expected_surplus[pid] = expected
    total_pts_added += expected
  }

  return { baselines, expected_surplus, total_pts_added, draws }
}

export default calculate_distributional_baselines
