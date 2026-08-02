import { get_all_play_win_percentage } from './compare-all-play-seed.mjs'

/**
 * At-large berth comparator.
 *
 * Total points for, then All Play win percentage.
 *
 * An at-large berth is not a claim to have beaten anyone -- the teams competing
 * for one have already failed to win a division or earn a bye. It is a claim to
 * have scored, so the league selects on points for and reaches for All Play only
 * to break a tie, which fractional scoring makes nearly impossible in practice.
 *
 * This restores the prior constitution's rule, which filled its two at-large
 * places with "the highest Total Points For (PF) among teams who are not 1st or
 * 2nd in their division".
 */
const compare_at_large_berth = (a, b) =>
  (b.points_for || 0) - (a.points_for || 0) ||
  get_all_play_win_percentage(b) - get_all_play_win_percentage(a)

export default compare_at_large_berth
