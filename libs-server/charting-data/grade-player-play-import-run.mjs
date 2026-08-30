// Output oracle for the sumersports player-play (by-play) import.
//
// An oracle distinct from the exit code, per
// user:guideline/surface-pipeline-failures.md. "main() did not throw" reads the
// same whether the run wrote 1.1M rows or selected zero games and idled.
//
// This grain needs one check the matchup oracle does not, and it is the reason
// this file exists rather than reusing that one. By-play rows have NO natural
// key: 1,618 rows from one game-team collapse to 796 distinct content values,
// because a lineman with the same alignment and role and no statistics produces
// a byte-identical row on every snap. So a truncated or partially fetched
// response cannot be detected by inspecting the rows. The only thing that can
// detect it is comparing the rows we INSERTED against the count the vendor
// RETURNED, per game and per team -- which is what rows_dropped counts, and why
// any nonzero value fails the run outright rather than riding a rate.

// A team-request either answers with a roster's worth of rows or it does not
// answer at all. Observed healthy: 1,617-1,871 rows per team across 2025 REG
// and 2026 PRE, and zero empty responses on charted games.
export const MAXIMUM_REQUEST_FAILURE_RATE = 0.2

// pid is a NULLABLE convenience here: the row is stored under the vendor's own
// player id regardless, so an unresolved player costs a join, never a row. The
// measured direct-id miss is 18% of players and 12.8% of rows before
// match_charting_player's name-plus-jersey fallback, which recovers most of it
// and writes the id back. The ceiling is set above the measured residual so a
// genuine collapse in matching is still caught.
export const MAXIMUM_PID_UNRESOLVED_RATE = 0.25

const format_rate = (rate) => `${(rate * 100).toFixed(1)}%`

export default function grade_player_play_import_run({
  games_selected,
  requests_attempted,
  requests_with_rows,
  requests_failed,
  requests_empty,
  rows_inserted,
  rows_returned,
  // Every row the vendor returned that did not reach the table. This is the
  // truncation detector and it has no tolerance: content-based validation is
  // impossible at this grain, so an unexplained shortfall is the only signal
  // there is.
  rows_dropped,
  pid_unresolved,
  // False when the scope legitimately holds no completed game yet -- the
  // current season ahead of its opener.
  expects_games = true
}) {
  const failures = []

  const request_failure_rate = requests_attempted
    ? (requests_attempted - requests_with_rows) / requests_attempted
    : 0
  const pid_unresolved_rate = rows_inserted ? pid_unresolved / rows_inserted : 0

  if (games_selected === 0 && expects_games) {
    failures.push('scope selected no games')
  } else if (requests_attempted > 0) {
    if (requests_with_rows === 0) {
      failures.push(
        `no rows written for any of ${requests_attempted} attempted request(s)`
      )
    } else if (request_failure_rate > MAXIMUM_REQUEST_FAILURE_RATE) {
      failures.push(
        `request failure rate ${format_rate(request_failure_rate)} exceeds ${format_rate(MAXIMUM_REQUEST_FAILURE_RATE)} (${requests_failed} failed, ${requests_empty} empty of ${requests_attempted} attempted)`
      )
    }

    if (rows_dropped > 0) {
      failures.push(
        `${rows_dropped} of ${rows_returned} vendor row(s) did not reach the table`
      )
    }

    if (pid_unresolved_rate > MAXIMUM_PID_UNRESOLVED_RATE) {
      failures.push(
        `pid unresolved rate ${format_rate(pid_unresolved_rate)} exceeds ${format_rate(MAXIMUM_PID_UNRESOLVED_RATE)} (${pid_unresolved} of ${rows_inserted} rows)`
      )
    }
  }

  const summary =
    `oracle ${failures.length ? 'FAIL' : 'PASS'}: ` +
    `${games_selected} game(s) in scope, ${requests_attempted} team request(s) attempted, ` +
    `${requests_with_rows} with rows, ${rows_inserted} row(s) inserted of ${rows_returned} returned, ` +
    `${pid_unresolved} row(s) with no pid` +
    (failures.length ? ` -- ${failures.join('; ')}` : '')

  return { passed: failures.length === 0, failures, summary }
}
