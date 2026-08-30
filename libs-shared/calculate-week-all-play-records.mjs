/**
 * One week's All Play record for every team: what each team's record would be
 * if it had played every other team that week.
 *
 * This is a league RULE, not a helper -- Article XVII of the constitution ranks
 * the teams admitted directly on All Play win percentage, so the standings page
 * and the season forecast are reading the same measure and must not compute it
 * two ways. Both call this.
 *
 * @param {object} params
 * @param {Map<number, number>} params.scores_by_team_id - One week's score per team
 * @returns {Map<number, {all_play_wins: number, all_play_losses: number, all_play_ties: number}>}
 */
export const calculate_week_all_play_records = ({ scores_by_team_id }) => {
  if (!(scores_by_team_id instanceof Map)) {
    throw new Error(
      'calculate_week_all_play_records requires scores_by_team_id as a Map; a plain object coerces its keys to strings and the records then key off a different team id than the caller holds'
    )
  }

  const entries = [...scores_by_team_id]

  for (const [team_id, score] of entries) {
    if (!Number.isFinite(score)) {
      throw new Error(
        `team ${team_id} has a non-finite week score (${score}); an All Play record derived from it silently ranks that team last against every opponent`
      )
    }
  }

  // Sorted once rather than filtered per team. Beyond the arithmetic, this is
  // what makes the tie rule explicit: teams sharing a score form a run, and
  // every member of that run draws with every other member.
  entries.sort((a, b) => a[1] - b[1])

  const records = new Map()
  const team_count = entries.length

  let index = 0
  while (index < team_count) {
    let run_end = index
    while (
      run_end + 1 < team_count &&
      entries[run_end + 1][1] === entries[index][1]
    ) {
      run_end++
    }

    const run_length = run_end - index + 1
    const all_play_wins = index
    const all_play_losses = team_count - index - run_length
    const all_play_ties = run_length - 1

    for (let position = index; position <= run_end; position++) {
      records.set(entries[position][0], {
        all_play_wins,
        all_play_losses,
        all_play_ties
      })
    }

    index = run_end + 1
  }

  return records
}

export default calculate_week_all_play_records
