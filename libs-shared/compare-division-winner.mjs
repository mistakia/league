import { get_all_play_win_percentage } from './compare-all-play-seed.mjs'

/**
 * Division winner comparator.
 *
 * Head-to-head record, then points for, then All Play win percentage.
 *
 * Note the tail runs OPPOSITE to compare_playoff_seed, which breaks a
 * head-to-head tie on All Play before points for. That is deliberate and it is
 * a league format choice, not an inconsistency to be tidied away: winning a
 * division is a head-to-head achievement decided among three teams, so the
 * league resolves it on points scored before reaching for a league-wide metric.
 */
const compare_division_winner = (a, b) =>
  (b.wins || 0) - (a.wins || 0) ||
  (a.losses || 0) - (b.losses || 0) ||
  (b.ties || 0) - (a.ties || 0) ||
  (b.points_for || 0) - (a.points_for || 0) ||
  get_all_play_win_percentage(b) - get_all_play_win_percentage(a)

export default compare_division_winner
