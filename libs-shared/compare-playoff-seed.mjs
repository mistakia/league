/**
 * Playoff seeding comparator.
 *
 * Seeds run strictly on head-to-head record, then all-play wins, then points
 * for. Division standing is deliberately NOT an input: the number of divisions
 * is derived from league size (three-team divisions where the team count
 * divides by three, otherwise a single division), so a seeding rule that keyed
 * on division finish would mean something different at every league size and
 * nothing at all in a single-division league.
 *
 * Takes flat stat objects so the standings calculation and the season forecast
 * simulation can share one ladder.
 */
const compare_playoff_seed = (a, b) =>
  (b.wins || 0) - (a.wins || 0) ||
  (a.losses || 0) - (b.losses || 0) ||
  (b.ties || 0) - (a.ties || 0) ||
  (b.all_play_wins || 0) - (a.all_play_wins || 0) ||
  (b.points_for || 0) - (a.points_for || 0)

export default compare_playoff_seed
