/**
 * How a playoff field resolves to a champion, given each team's score.
 *
 * Shared by the season forecast and the playoff forecast so the bracket is
 * defined once. The season forecast used to carry its own copy that ranked on
 * Math.random(), which produced a championship number carrying no roster,
 * projection or record signal while reading exactly like a forecast.
 *
 * Neither function knows where a score came from -- a Monte Carlo draw or a
 * completed week's actual points -- which is what lets a partly-played round be
 * resolved by the same code as a fully simulated one.
 */

/**
 * The highest-scoring team, or null when there are no teams to compare.
 * The running maximum starts at -Infinity so a field of negative totals still
 * produces a winner, and the null is distinguished from a tid, which may be any
 * integer.
 *
 * @param {object} params
 * @param {number[]} params.team_ids - Teams to compare
 * @param {(tid: number) => number} params.get_score - Score for a team
 * @returns {number | null} Winning team ID
 */
export const find_highest_scoring_team = ({ team_ids, get_score }) => {
  let max_score = -Infinity
  let winner_tid = null
  for (const tid of team_ids) {
    const score = get_score(tid)
    if (score > max_score) {
      max_score = score
      winner_tid = tid
    }
  }
  return winner_tid
}

/**
 * The wildcard teams that advance: the highest scorers, one per pairing.
 *
 * @param {object} params
 * @param {number[]} params.wildcard_tids - Teams playing the wildcard round
 * @param {number} params.survivor_count - Teams that advance
 * @param {(tid: number) => number} params.get_score - Wildcard score for a team
 * @returns {number[]} Advancing team IDs
 */
export const select_wildcard_winners = ({
  wildcard_tids,
  survivor_count,
  get_score
}) =>
  wildcard_tids
    .map((tid) => ({ tid, score: get_score(tid) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, survivor_count)
    .map((r) => r.tid)

/**
 * One winner per wildcard pairing. The championship round is the byes plus
 * these survivors.
 *
 * @param {object} params
 * @param {number} params.playoff_team_count - Size of the playoff field
 * @param {number} params.bye_count - Teams admitted directly
 * @returns {number} Teams advancing out of the wildcard round
 */
export const count_wildcard_survivors = ({ playoff_team_count, bye_count }) =>
  Math.floor((playoff_team_count - bye_count) / 2)
