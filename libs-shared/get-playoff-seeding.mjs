import compare_playoff_seed from './compare-playoff-seed.mjs'

/**
 * Order a league's teams into playoff seeds.
 *
 * The playoff format is configuration, not a constant: field size, how many of
 * those seeds receive a bye, and whether division winners are guaranteed a
 * berth all come from the league's own season settings. Nothing here assumes a
 * particular league's rules.
 *
 * Seeds run on compare_playoff_seed -- head-to-head record, then all-play
 * wins, then points for. When has_division_winner_berths is set, each division's
 * best team by that ladder is lifted to the front of the order (in ladder order
 * among themselves) and the remaining berths fill in behind them; otherwise
 * divisions do not enter into seeding at all.
 *
 * @param {Object} params
 * @param {Array} params.teams - flat objects with tid, div, and the stat keys
 *   compare_playoff_seed reads
 * @param {number} params.playoff_team_count - size of the playoff field
 * @param {number} params.bye_count - how many top seeds skip the first round
 * @param {boolean} [params.has_division_winner_berths] - guarantee division
 *   winners a berth
 * @returns {{ seeded_tids: Array, playoff_tids: Array, bye_tids: Array, wildcard_tids: Array }}
 */
const get_playoff_seeding = ({
  teams,
  playoff_team_count,
  bye_count,
  has_division_winner_berths = false
}) => {
  if (!Number.isInteger(playoff_team_count) || playoff_team_count < 1) {
    throw new Error(
      `playoff_team_count must be a positive integer, got ${playoff_team_count}`
    )
  }

  if (
    !Number.isInteger(bye_count) ||
    bye_count < 0 ||
    bye_count > playoff_team_count
  ) {
    throw new Error(
      `bye_count must be between 0 and playoff_team_count (${playoff_team_count}), got ${bye_count}`
    )
  }

  const by_seed = [...teams].sort(compare_playoff_seed)

  let ordered = by_seed

  if (has_division_winner_berths) {
    // by_seed is already in ladder order, so the first team encountered in a
    // division is that division's winner and the winners emerge in ladder
    // order too.
    const division_winners = []
    const divisions_seen = new Set()
    for (const team of by_seed) {
      if (!divisions_seen.has(team.div)) {
        divisions_seen.add(team.div)
        division_winners.push(team)
      }
    }

    const winner_tids = new Set(division_winners.map((team) => team.tid))
    ordered = [
      ...division_winners,
      ...by_seed.filter((team) => !winner_tids.has(team.tid))
    ]
  }

  const seeded_tids = ordered.map((team) => team.tid)
  const playoff_tids = seeded_tids.slice(0, playoff_team_count)

  return {
    seeded_tids,
    playoff_tids,
    bye_tids: playoff_tids.slice(0, bye_count),
    wildcard_tids: playoff_tids.slice(bye_count)
  }
}

export default get_playoff_seeding
