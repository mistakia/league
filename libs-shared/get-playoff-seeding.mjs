import compare_playoff_seed from './compare-playoff-seed.mjs'
import compare_all_play_seed from './compare-all-play-seed.mjs'

export const BYE_CANDIDATE_POOLS = ['league', 'division_winners']
export const BYE_SELECTION_METHODS = ['head_to_head', 'all_play']

/**
 * Order a league's teams into playoff seeds.
 *
 * The playoff format is configuration, not a constant. Field size, how many of
 * those seeds receive a bye, which teams are eligible for a bye, what ladder
 * ranks them, and whether division winners are guaranteed a berth all come from
 * the league's own season settings. Nothing here assumes a particular league's
 * rules.
 *
 * Bye selection is a step of its own, deliberately not folded into the seed
 * sort. A league can rank byes on a different basis than it orders the rest of
 * the field, and can restrict bye eligibility to division winners -- neither is
 * expressible as a single comparator over the whole league.
 *
 *   1. Byes. Take the candidate pool (the whole league, or one winner per
 *      division), rank it by the configured ladder, and take the top bye_count.
 *   2. Berths. Order everyone else by compare_playoff_seed and fill the
 *      remaining places in the field. When has_division_winner_berths is set,
 *      every division winner without a bye takes one of those places first and
 *      the field is then re-ordered on the standings ladder, so the guarantee
 *      admits a winner without also promoting them past a better team.
 *
 * A division winner is the division's best team by compare_playoff_seed. Note
 * that this is the standings ladder, not the bye ladder: winning a division and
 * ranking among the winners are separate questions, and only the second is
 * stated in terms of All Play.
 *
 * @param {Object} params
 * @param {Array} params.teams - flat objects with tid, div, and the stat keys
 *   the comparators read
 * @param {number} params.playoff_team_count - size of the playoff field
 * @param {number} params.bye_count - how many top seeds skip the first round
 * @param {string} [params.bye_candidate_pool] - 'league' or 'division_winners'
 * @param {string} [params.bye_selection_method] - 'head_to_head' or 'all_play'
 * @param {boolean} [params.has_division_winner_berths] - guarantee every
 *   division winner a place in the field
 * @returns {{ seeded_tids: Array, playoff_tids: Array, bye_tids: Array, wildcard_tids: Array }}
 */
const get_playoff_seeding = ({
  teams,
  playoff_team_count,
  bye_count,
  bye_candidate_pool = 'league',
  bye_selection_method = 'head_to_head',
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

  if (!BYE_CANDIDATE_POOLS.includes(bye_candidate_pool)) {
    throw new Error(
      `bye_candidate_pool must be one of ${BYE_CANDIDATE_POOLS.join(', ')}, got ${bye_candidate_pool}`
    )
  }

  if (!BYE_SELECTION_METHODS.includes(bye_selection_method)) {
    throw new Error(
      `bye_selection_method must be one of ${BYE_SELECTION_METHODS.join(', ')}, got ${bye_selection_method}`
    )
  }

  // A league with fewer teams than its configured field size is not an error --
  // it is a league mid-setup, and standings still have to compute. The field is
  // simply capped at the teams that exist.
  const by_record = [...teams].sort(compare_playoff_seed)

  // by_record is in ladder order, so the first team seen in a division is that
  // division's winner.
  const division_winners = []
  const divisions_seen = new Set()
  for (const team of by_record) {
    if (!divisions_seen.has(team.div)) {
      divisions_seen.add(team.div)
      division_winners.push(team)
    }
  }

  const bye_candidates =
    bye_candidate_pool === 'division_winners' ? division_winners : by_record

  if (bye_candidates.length < bye_count) {
    throw new Error(
      `bye_candidate_pool '${bye_candidate_pool}' yields ${bye_candidates.length} candidate(s), fewer than bye_count (${bye_count})`
    )
  }

  const compare_bye =
    bye_selection_method === 'all_play'
      ? compare_all_play_seed
      : compare_playoff_seed

  const bye_teams = [...bye_candidates].sort(compare_bye).slice(0, bye_count)
  const bye_tid_set = new Set(bye_teams.map((team) => team.tid))

  const remaining = by_record.filter((team) => !bye_tid_set.has(team.tid))
  const remaining_berths = playoff_team_count - bye_count

  let field = remaining.slice(0, remaining_berths)

  if (has_division_winner_berths) {
    // Guarantee a place, not a seed. Every division winner without a bye is put
    // in the field, the rest of the places go to the best teams left, and the
    // whole field is then ordered on the standings ladder -- so the guarantee
    // admits a winner without also promoting them past a better team.
    const guaranteed = division_winners.filter(
      (team) => !bye_tid_set.has(team.tid)
    )

    if (guaranteed.length > remaining_berths) {
      throw new Error(
        `has_division_winner_berths requires ${guaranteed.length} berth(s) for division winners, more than the ${remaining_berths} remaining after byes`
      )
    }

    const guaranteed_tids = new Set(guaranteed.map((team) => team.tid))
    const others = remaining.filter((team) => !guaranteed_tids.has(team.tid))

    field = [
      ...guaranteed,
      ...others.slice(0, remaining_berths - guaranteed.length)
    ].sort(compare_playoff_seed)
  }

  const field_tid_set = new Set(field.map((team) => team.tid))
  const missed = remaining.filter((team) => !field_tid_set.has(team.tid))

  const seeded_tids = [...bye_teams, ...field, ...missed].map(
    (team) => team.tid
  )
  const playoff_tids = seeded_tids.slice(0, playoff_team_count)

  return {
    seeded_tids,
    playoff_tids,
    bye_tids: playoff_tids.slice(0, bye_count),
    wildcard_tids: playoff_tids.slice(bye_count)
  }
}

export default get_playoff_seeding
