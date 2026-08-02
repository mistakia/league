/**
 * All Play seeding comparator.
 *
 * Orders teams by All Play win percentage, then by points for. Used to rank the
 * bye candidates in a league whose format selects byes on All Play rather than
 * on head-to-head record.
 *
 * Percentage rather than raw All Play wins: every team in a season plays the
 * same number of weeks, so the two agree in practice, but the percentage is what
 * the tiebreaker is stated as and it stays correct if a team is ever compared
 * across an unequal number of games.
 *
 * Ties count as half a win, matching the usual reading of a win percentage.
 */
export const get_all_play_win_percentage = (team) => {
  const wins = team.all_play_wins || 0
  const losses = team.all_play_losses || 0
  const ties = team.all_play_ties || 0
  const total = wins + losses + ties

  if (!total) {
    return 0
  }

  return (wins + ties / 2) / total
}

const compare_all_play_seed = (a, b) =>
  get_all_play_win_percentage(b) - get_all_play_win_percentage(a) ||
  (b.points_for || 0) - (a.points_for || 0)

export default compare_all_play_seed
