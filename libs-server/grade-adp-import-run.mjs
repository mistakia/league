// Output oracle shared by every per-vendor ADP importer.
//
// The importers declared success on "main() did not throw", which reads the
// same whether a run wrote 500 rows or fetched a redesigned page, parsed zero
// players and idled -- the silent-no-op shape in
// user:guideline/surface-pipeline-failures.md. Every per-player lookup failure
// inside these scripts is caught and pushed onto an unmatched list, so a broken
// find_player_row or a vendor markup change produces zero inserts and still
// reports success. That is exactly how the 2025 season ended up with ADP from
// one source only, and nothing said so until a data view rendered blank.
//
// Grain: per FEED, not per run. CBS, MFL and RTS each pull several scoring
// formats in one process, and a season-wide total is blind to one of them going
// dead -- the coarse-grain lesson from import-plays-nflfastr. Each feed the run
// ingested is graded on its own.
//
// Pure: takes counters the runs already keep and returns a verdict plus the
// line to print, so the caller decides how to surface it.

// A vendor draft board carries hundreds of players. The smallest live feed
// observed in 2026 is MFL standard at 120 rows written, so a floor of 50
// sits well below every healthy feed and well above the parse-collapse case it
// exists to catch (0-2 rows from a markup change).
export const MINIMUM_FEED_PLAYERS = 50

// Matching resolves a vendor player id, then falls back to name/team/position.
// The residual is the long tail of camp bodies the vendor lists and we do not
// carry. The floor is deliberately loose on first authoring -- every run now
// prints its real rate, so it can be tightened against observed evidence rather
// than a guess.
export const MINIMUM_MATCH_RATE = 0.5

const format_rate = (rate) => `${(rate * 100).toFixed(1)}%`

export default function grade_adp_import_run({
  source_id,
  year,
  // [{ label, fetched, matched, with_adp }] -- one entry per feed the run
  // actually ingested. with_adp counts matched rows carrying a non-null
  // average draft position; omit it and the null-ADP rule is skipped.
  feeds = [],
  minimum_feed_players = MINIMUM_FEED_PLAYERS,
  minimum_match_rate = MINIMUM_MATCH_RATE
}) {
  const failures = []

  if (!feeds.length) {
    failures.push('no feeds ingested')
  }

  for (const feed of feeds) {
    const { label, fetched = 0, matched = 0, with_adp } = feed
    const match_rate = fetched ? matched / fetched : 0

    if (fetched === 0) {
      // "Produced nothing" and "had nothing to produce" must not share an
      // outcome: a draft board is never legitimately empty during the window
      // these jobs run, so zero fetched is a dead endpoint or a markup change.
      failures.push(`feed ${label} returned 0 players`)
      continue
    }

    if (fetched < minimum_feed_players) {
      failures.push(
        `feed ${label} returned only ${fetched} player(s) (floor ${minimum_feed_players})`
      )
    }

    if (matched === 0) {
      failures.push(`feed ${label} matched 0 of ${fetched} player(s)`)
      continue
    }

    if (match_rate < minimum_match_rate) {
      failures.push(
        `feed ${label} match rate ${format_rate(match_rate)} below ${format_rate(minimum_match_rate)} (${matched} of ${fetched})`
      )
    }

    // Rows can be written and still carry nothing: a renamed vendor field
    // parses to null for every player, which a presence check reads as healthy
    // because the rows exist. Fill-rate is the separate assertion.
    if (with_adp !== undefined && with_adp === 0) {
      failures.push(
        `feed ${label} matched ${matched} player(s) but none carried an average draft position`
      )
    }
  }

  const feed_summaries = feeds.map((feed) => {
    const rate = feed.fetched ? feed.matched / feed.fetched : 0
    const with_adp =
      feed.with_adp === undefined ? '' : `, ${feed.with_adp} with adp`
    return `${feed.label}: ${feed.matched}/${feed.fetched} matched (${format_rate(rate)})${with_adp}`
  })

  const summary =
    `oracle ${failures.length ? 'FAIL' : 'PASS'}: ` +
    `${source_id} ${year} -- ${feeds.length} feed(s) ingested` +
    (feed_summaries.length ? ` [${feed_summaries.join('; ')}]` : '') +
    (failures.length ? ` -- ${failures.join('; ')}` : '')

  return { passed: failures.length === 0, failures, summary }
}
