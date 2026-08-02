import compare_playoff_seed from './compare-playoff-seed.mjs'
import compare_all_play_seed from './compare-all-play-seed.mjs'
import compare_at_large_berth from './compare-at-large-berth.mjs'

export const BYE_CANDIDATE_POOLS = ['league', 'division_winners']
export const BYE_SELECTION_METHODS = ['head_to_head', 'all_play']
export const AT_LARGE_SELECTION_METHODS = [
  'head_to_head',
  'all_play',
  'points_for'
]

const at_large_comparators = {
  head_to_head: compare_playoff_seed,
  all_play: compare_all_play_seed,
  points_for: compare_at_large_berth
}

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
 *   2. Berths. When has_division_winner_berths is set, every division winner
 *      without a bye takes one of the remaining places. The rest go to the best
 *      of the field on the at-large ladder, which is its own configured metric.
 *      The whole field is then ordered on the standings ladder, so the
 *      guarantee admits a winner without promoting them past a better team.
 *
 * Three ladders are in play and they are deliberately different, because they
 * answer different questions:
 *
 *   - ordering the standings, and with it deciding a division title:
 *     compare_playoff_seed -- head-to-head, then All Play, then points for
 *   - ranking the bye candidates: bye_selection_method
 *   - taking an at-large berth: at_large_selection_method
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
  at_large_selection_method = 'head_to_head',
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

  if (!AT_LARGE_SELECTION_METHODS.includes(at_large_selection_method)) {
    throw new Error(
      `at_large_selection_method must be one of ${AT_LARGE_SELECTION_METHODS.join(', ')}, got ${at_large_selection_method}`
    )
  }

  // A league with fewer teams than its configured field size is not an error --
  // it is a league mid-setup, and standings still have to compute. The field is
  // simply capped at the teams that exist.
  const by_record = [...teams].sort(compare_playoff_seed)

  // A division winner is its division's best team on the standings ladder, so
  // the first team seen per division walking by_record is that division's
  // winner, and the winners come out in ladder order.
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

  // At-large berths are selected on their own ladder, which need not be the
  // standings ladder: a league can seed on record and still award its last
  // places on points scored, which is what this one does.
  const compare_at_large = at_large_comparators[at_large_selection_method]

  // Guarantee a place, not a seed. Every division winner without a bye takes
  // one of the remaining places first, the rest go to the best of the field on
  // the at-large ladder, and the whole field is then ordered on the standings
  // ladder -- so the guarantee admits a winner without promoting them past a
  // better team.
  const guaranteed = has_division_winner_berths
    ? division_winners.filter((team) => !bye_tid_set.has(team.tid))
    : []

  if (guaranteed.length > remaining_berths) {
    throw new Error(
      `has_division_winner_berths requires ${guaranteed.length} berth(s) for division winners, more than the ${remaining_berths} remaining after byes`
    )
  }

  const guaranteed_tids = new Set(guaranteed.map((team) => team.tid))
  const at_large_candidates = remaining
    .filter((team) => !guaranteed_tids.has(team.tid))
    .sort(compare_at_large)

  const field = [
    ...guaranteed,
    ...at_large_candidates.slice(0, remaining_berths - guaranteed.length)
  ].sort(compare_playoff_seed)

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
