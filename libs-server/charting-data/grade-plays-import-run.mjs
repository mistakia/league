// Output oracle for the sumersports play-level charting import.
//
// Added when this import was first put on a schedule. Until then it declared
// success on "main() did not throw", which reads the same whether it wrote a
// season of charting or matched nothing at all -- the silent-no-op shape in
// user:guideline/surface-pipeline-failures.md. The run already computed every
// number needed to tell those apart and simply never asserted on them.
//
// The MATCH RATE is the reason this file is worth its weight, and the threshold
// is not a guess. The importer matches a vendor play to an nfl_plays row by
// sequence number, falling back to context. From the first run in April 2026
// until 2026-08-30 the sequence lookup compared a numeric STRING against a
// NUMBER and therefore matched nothing at all -- every play fell to the context
// fallback, which resolved about 54 percent of them. With the coercion fixed
// the rate is 99.9 percent, measured over 961 plays in six 2025 games.
//
// So a floor here separates the two states cleanly, and it is the check that
// would have caught the original defect on its first scheduled run.
export const MINIMUM_PLAY_MATCH_RATE = 0.85

// A game the vendor has not charted returns a full play list with no charting
// values, so some games legitimately contribute nothing. A run where EVERY
// attempted game fails is caught separately below.
export const MAXIMUM_GAME_FAILURE_RATE = 0.2

const format_rate = (rate) => `${(rate * 100).toFixed(1)}%`

export default function grade_plays_import_run({
  games_selected,
  games_processed,
  games_failed,
  games_empty,
  total_plays_matched,
  total_plays_unmatched,
  total_fields_updated,
  // False when the scope legitimately holds nothing to do. Distinct from a
  // scope that matched no games at all: the steady state of a weekly run is
  // that everything in range is already imported, and that must pass.
  expects_games = true
}) {
  const failures = []

  const games_attempted = games_processed + games_failed
  const game_failure_rate = games_attempted ? games_failed / games_attempted : 0
  const plays_seen = total_plays_matched + total_plays_unmatched
  const match_rate = plays_seen ? total_plays_matched / plays_seen : 0

  if (games_selected === 0 && expects_games) {
    failures.push('scope selected no games')
  } else if (games_attempted > 0) {
    if (game_failure_rate > MAXIMUM_GAME_FAILURE_RATE) {
      failures.push(
        `game failure rate ${format_rate(game_failure_rate)} exceeds ${format_rate(MAXIMUM_GAME_FAILURE_RATE)} (${games_failed} failed, ${games_empty} empty of ${games_attempted} attempted)`
      )
    }

    // Guarded on plays_seen rather than folded into the rate: a run whose games
    // all returned empty lists has no plays to match, and reporting a 0% match
    // rate there would name the wrong defect.
    if (plays_seen > 0 && match_rate < MINIMUM_PLAY_MATCH_RATE) {
      failures.push(
        `play match rate ${format_rate(match_rate)} below ${format_rate(MINIMUM_PLAY_MATCH_RATE)} (${total_plays_matched} of ${plays_seen} plays)`
      )
    }
  }

  const summary =
    `oracle ${failures.length ? 'FAIL' : 'PASS'}: ` +
    `${games_selected} game(s) needing import, ${games_processed} processed, ` +
    `${total_plays_matched} of ${plays_seen} play(s) matched, ` +
    `${total_fields_updated} field(s) updated` +
    (failures.length ? ` -- ${failures.join('; ')}` : '')

  return { passed: failures.length === 0, failures, summary }
}
