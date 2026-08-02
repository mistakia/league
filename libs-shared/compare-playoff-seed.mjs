import { get_all_play_win_percentage } from './compare-all-play-seed.mjs'

/**
 * Playoff seeding comparator.
 *
 * Head-to-head record, then All Play win percentage, then points for.
 *
 * This is the league's general ladder and it does three jobs: ordering the
 * standings, deciding a division title, and selecting berths in a league whose
 * at_large_selection_method is head_to_head. Bye selection and points-for
 * at-large selection lead on a different metric and have their own comparators.
 *
 * Division standing is deliberately NOT an input here. Where divisions exist
 * they decide who is eligible for a bye and who is guaranteed a berth, and
 * get_playoff_seeding applies both as separate steps; folding division finish
 * into the comparator would mean something different at every league size and
 * nothing at all in a single-division league.
 *
 * All Play as a PERCENTAGE rather than raw wins: within a season the two agree,
 * since every team plays the same number of weeks, but the percentage is what
 * the constitution states and it stays correct across an unequal number of
 * games.
 *
 * Takes flat stat objects so the standings calculation and the season forecast
 * simulation can share one ladder.
 */
const compare_playoff_seed = (a, b) =>
  (b.wins || 0) - (a.wins || 0) ||
  (a.losses || 0) - (b.losses || 0) ||
  (b.ties || 0) - (a.ties || 0) ||
  get_all_play_win_percentage(b) - get_all_play_win_percentage(a) ||
  (b.points_for || 0) - (a.points_for || 0)

export default compare_playoff_seed
