/**
 * Play-type predicate sets for `nfl_plays.play_type`.
 *
 * These filter `play_type` -- NOT `play_type_nfl` and NOT `play_type_ngs`,
 * which carry the upstream vocabularies and do not agree with this one.
 *
 * WHY THESE EXIST. Whether a play COUNTS toward a stat used to be inferred
 * from whether a role `_pid` column happened to be null. That overloaded one
 * nullable column with two questions -- who occupied the role, and did this
 * play count -- and the two answers only agree on an ordinary play. Role
 * `_pid` is now attribution alone, so countability has to be asked explicitly,
 * and these are what asks it.
 *
 * WHY THERE ARE THREE OF THEM AND NOT ONE. Countability is per stat family,
 * not one play-level fact. Kickers, punters and returners have real from-plays
 * production on KOFF, PUNT and FGXP rows, which carry no role pids at all, and
 * defensive production on a two-point conversion is real even though the
 * passing and receiving production on that same play is not. A single set
 * spanning all of that zeroes every kicker and every return touchdown. Pick
 * the set that matches the question; do not merge them.
 *
 * THE FULL VOCABULARY is the eight labels of the Postgres `play_type` enum:
 * PASS, RUSH, NOPL, CONV, KOFF, PUNT, FGXP, FREE.
 *
 * FREE (a free kick following a safety) is a real, live play and is countable.
 * It is in every set here except the scrimmage one.
 *
 * NULL `play_type` is NOT countable and is absent from every set. This is not
 * a behavior change from the `<> 'NOPL'` deny-lists these replace: `NULL <>
 * 'NOPL'` is NULL, never true, so a deny-list drops NULL rows exactly as an
 * allow-list does (verified against `nfl_plays`: 24,973 NULL rows, kept by
 * neither form). The gain is that the exclusion is now intentional rather than
 * incidental. A minority of those rows are real plays mis-enriched in 2021 --
 * their `play_type_nfl` reads PASS, RUSH or SACK -- and recovering them is a
 * separate question from this one.
 */

/**
 * Offensive plays from scrimmage. This is a rate DENOMINATOR set, not a
 * countability set: it answers "how many offensive snaps did this team or
 * player take", which is what per-play rate stats divide by. Widening it to
 * include special teams would inflate every from-plays rate denominator and
 * silently deflate every rate stat. Two meanings share this one constant --
 * the scrimmage-play set and the offensive-snap denominator -- deliberately,
 * because they have never differed and a second name for the same values
 * would drift without anything detecting it. Split it only if the values
 * actually diverge.
 */
export const scrimmage_play_types = ['PASS', 'RUSH']

/**
 * Plays whose passing, rushing and receiving production counts as a standard
 * stat. Excludes NOPL, because a penalty-nullified play did not happen, and
 * CONV, because the NFL books a two-point conversion outside standard passing,
 * rushing and receiving statistics and so do we.
 *
 * This is the set for the player and team from-plays stat paths. It is NOT the
 * set for fantasy scoring, which must reach CONV, FGXP, KOFF and PUNT to score
 * two-point conversions, field goals, extra points and return touchdowns.
 */
export const stat_countable_play_types = [
  'PASS',
  'RUSH',
  'KOFF',
  'PUNT',
  'FGXP',
  'FREE'
]

/**
 * Plays that were not nullified by a penalty. Excludes NOPL only.
 *
 * This is the set for DEFENSIVE from-plays production, which differs from
 * `stat_countable_play_types` in exactly one member: a tackle, sack or
 * interception on a two-point conversion is a real defensive play and must not
 * be dropped. "Non-nullified" is the accurate name for this set and a wrong
 * name for the one above, since CONV is not nullified.
 */
export const non_nullified_play_types = [
  'PASS',
  'RUSH',
  'CONV',
  'KOFF',
  'PUNT',
  'FGXP',
  'FREE'
]
