// Output oracle for the sumersports matchup-stats import.
//
// The import used to declare success on "main() did not throw", which reads the
// same whether it wrote 48,600 rows or selected zero games and idled -- the
// silent-no-op shape in user:guideline/surface-pipeline-failures.md. The run
// already computes every number needed to tell those apart and simply never
// asserted on them.
//
// Grain: per GAME, not per season. A season-wide row-count floor is blind to a
// handful of games returning nothing, because a few games are a rounding error
// against a season denominator. Each attempted game is graded on whether it
// produced rows at all.

// Observed healthy rate is 0 failures across all 285 games of 2025 (272 REG +
// 13 POST), so the ceiling sits well above healthy and well below the degraded
// case it exists to catch. A run whose attempted games ALL fail is caught by
// the zero-coverage rule below regardless of this rate.
export const MAXIMUM_GAME_FAILURE_RATE = 0.2

// Player matching resolves a sumersports player id against our player table; a
// miss drops that one matchup row. Observed healthy rate is ~3.6% (1,800 of
// 50,400 across 2025), which is the long tail of practice-squad and short-stint
// players the vendor charts and we do not carry.
export const MAXIMUM_PLAYERS_UNMATCHED_RATE = 0.15

const format_rate = (rate) => `${(rate * 100).toFixed(1)}%`

// Grades one completed import run. Pure: takes the counters the run already
// keeps and returns a verdict plus the line to print, so the caller decides how
// to surface it.
export default function grade_matchup_import_run({
  games_selected,
  games_attempted,
  games_with_rows,
  games_failed,
  games_empty,
  total_matchups_inserted,
  players_unmatched
}) {
  const failures = []

  const game_failure_rate = games_attempted
    ? (games_attempted - games_with_rows) / games_attempted
    : 0
  const matchups_seen = total_matchups_inserted + players_unmatched
  const players_unmatched_rate = matchups_seen
    ? players_unmatched / matchups_seen
    : 0

  if (games_selected === 0) {
    // The scope matched nothing at all -- a wrong --year, a season whose games
    // carry no shield_game_id, or a week that has not been played. Distinct
    // from "everything in scope is already imported", which is the healthy
    // steady state of a scheduled run and passes below.
    failures.push('scope selected no games')
  } else if (games_attempted > 0) {
    if (games_with_rows === 0) {
      failures.push(
        `no rows written for any of ${games_attempted} attempted game(s)`
      )
    } else if (game_failure_rate > MAXIMUM_GAME_FAILURE_RATE) {
      failures.push(
        `game failure rate ${format_rate(game_failure_rate)} exceeds ${format_rate(MAXIMUM_GAME_FAILURE_RATE)} (${games_failed} failed, ${games_empty} empty of ${games_attempted} attempted)`
      )
    }

    if (players_unmatched_rate > MAXIMUM_PLAYERS_UNMATCHED_RATE) {
      failures.push(
        `player unmatched rate ${format_rate(players_unmatched_rate)} exceeds ${format_rate(MAXIMUM_PLAYERS_UNMATCHED_RATE)} (${players_unmatched} of ${matchups_seen} matchups)`
      )
    }
  }

  const summary =
    `oracle ${failures.length ? 'FAIL' : 'PASS'}: ` +
    `${games_selected} game(s) in scope, ${games_attempted} attempted, ` +
    `${games_with_rows} with rows, ${games_failed} failed, ${games_empty} empty, ` +
    `${total_matchups_inserted} matchups written, ` +
    `${players_unmatched} unmatched (${format_rate(players_unmatched_rate)})` +
    (failures.length ? ` -- ${failures.join('; ')}` : '')

  return { passed: failures.length === 0, failures, summary }
}
