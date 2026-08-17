import { fantasy_positions, default_points_added } from '#constants'
import get_eligible_slots from './get-eligible-slots.mjs'
import calculate_projection_dispersion from './calculate-projection-dispersion.mjs'
import { get_player_week_total } from './get-player-week-points.mjs'

// Week `0` is the SEASON board -- the whole-season projection every other week
// key sits beside. This module answers the season question only, and named
// rather than written as a bare 0 at each call site because the boundary is a
// deliberate scope decision rather than an index.
//
// WHY SEASON ONLY. Weeks 1+ keep the point-estimate path
// (calculate-baselines.mjs plus calculate-values.mjs), for two reasons that
// point the same way.
//
// It is a different question. The season board says what a player is worth for
// the year, which is what market_salary means and what restricted free agency
// tags, franchise schedules and rookie schedules price off. A weekly board says
// what starting him this Sunday is worth over the week's replacement -- a
// start/sit signal, deliberately signed, whose negative range is read directly
// (see libs-server/tag-board/build-tag-board.mjs, which uses pts_added as a
// continuous signal precisely because market_salary clips at zero).
//
// And it is not affordable. One 1000-draw pass over the real 2026 board (624
// players, 90 slots) costs about 9 seconds. process-projections covers 23 league
// formats plus each hosted league, and loops weeks 0 through the final week --
// 19 weeks in the offseason. Applied to every week that is roughly 70 minutes
// per run against an hourly cron. Season only is under 4 minutes.
//
// Every measurement behind this rebuild was made on week 0. Applying it to the
// weekly boards would ship an unmeasured change, so the weekly path keeps its
// known bias rather than trading it for an unknown one.
export const season_projection_week = 0

// The season board publishes TWO variants, and the net one lives under its own
// named aggregation key rather than a second numeric week -- `week` is a period
// and the variant is not a period. Mixing the two axes into one column is what
// let the period sentinels accumulate on the projection-values tables; see
// process-projections.mjs.
export const season_net_projection_key = 'season_net'

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
  for (let team = 0; team < league.number_teams; team++) {
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

// players: [{ pid, primary_position, points: { [week]: { total } } }]
//
// Returns expected replacement points per position, expected floored surplus
// per player, and their total -- the denominator calculate-prices divides the
// discretionary cap by.
// `dispersion_by_pid` is an override for specs, alongside `draws` and `random`.
// Production never passes it -- the model derives dispersion from the board it
// is pricing.
const calculate_distributional_baselines = ({
  players,
  league,
  week,
  draws = 1000,
  random = default_random,
  dispersion_by_pid: dispersion_override = null
}) => {
  const slots = build_league_starting_slots({ league })
  const normal = make_normal_source(random)

  // Dispersion is derived from this board, not read off a persisted column, so
  // a reweighted board carries the dispersion that belongs to it. See
  // calculate-projection-dispersion.mjs.
  const dispersion_by_pid =
    dispersion_override ??
    calculate_projection_dispersion({ players, week }).dispersion_by_pid

  const pids = []
  const positions = []
  const means = []
  const dispersions = []
  for (const player of players) {
    const position = player.primary_position
    if (!fantasy_positions.includes(position)) continue
    if (!slots.some((slot) => slot_accepts(slot, position))) continue
    const total = get_player_week_total({ player, week })
    if (!(total > 0)) continue
    pids.push(player.pid)
    positions.push(position)
    means.push(total)
    dispersions.push(Math.max(dispersion_by_pid[player.pid] || 0, 0))
  }

  const baseline_totals = {}
  const surplus_totals = {}
  const net_surplus_totals = {}
  for (const position of fantasy_positions) baseline_totals[position] = 0
  for (const pid of pids) {
    surplus_totals[pid] = 0
    net_surplus_totals[pid] = 0
  }

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
      // The net variant is the same quantity WITHOUT the per-draw floor:
      // E[X - baseline] beside E[max(X - baseline, 0)]. It must be accumulated
      // per draw for the mirror image of the reason the floored one is -- taking
      // the expectation first and subtracting after would give
      // E[X] - baseline, which is a different number whenever the baseline
      // covaries with the draw, and the baseline here is redrawn every pass.
      // One addition per draw, no additional draws.
      net_surplus_totals[pids[i]] += values[i] - replacement
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
  const expected_net_surplus = {}
  let total_pts_added = 0
  for (const pid of pids) {
    const expected = surplus_totals[pid] / draws
    expected_surplus[pid] = expected
    expected_net_surplus[pid] = net_surplus_totals[pid] / draws
    total_pts_added += expected
  }

  return {
    baselines,
    expected_surplus,
    expected_net_surplus,
    total_pts_added,
    draws
  }
}

// Write the drawn expectation onto the player rows, in the shape the rest of the
// pipeline already reads. The counterpart of calculate-values.mjs for the season
// board: same output field, same sentinel, different question.
//
// Expected surplus is E[max(X - baseline, 0)] and so is floored at zero by
// construction -- a player projected below replacement still has some chance of
// clearing it, which is worth a small positive amount, and no chance of being
// worth less than nothing because he would simply not be started.
//
// The NET variant, E[X - baseline], is the same expectation without that floor:
// what he adds when you must start him every week rather than bench him when he
// busts. It is signed, and it is the quantity a league format with no viable
// bench should read. The two are not a rescale of one another -- the gap between
// them is the value of the option to bench, which is largest exactly where
// dispersion is largest.
//
// A player absent from expected_surplus was never in the drawn pool -- a kicker,
// a position the league does not start, or a player with no projection for the
// season -- and takes the same sentinel the weekly path gives him, on both.
export const assign_expected_surplus = ({
  players,
  expected_surplus,
  expected_net_surplus,
  week
}) => {
  for (const player of players) {
    if (!player.pts_added) {
      player.pts_added = {}
    }

    const surplus = expected_surplus[player.pid]
    player.pts_added[week] =
      surplus === undefined ? default_points_added : surplus

    const net_surplus = expected_net_surplus[player.pid]
    player.pts_added[season_net_projection_key] =
      net_surplus === undefined ? default_points_added : net_surplus
  }

  return players
}

export default calculate_distributional_baselines
