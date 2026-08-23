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
// carry. Authored loose at 0.5 because no historical fetched-vs-matched figures
// existed; tightened 2026-08-23 against the first live measurement of all six
// feeds on the league host, which ran 77.2% to 100.0%:
//
//   ESPN PPR 99.6% | YAHOO half-PPR 93.2% | MFL standard 93.8%, PPR 77.2%
//   CBS PPR 90.8%, standard 90.9% | RTS PPR 99.6%, superflex 100%, dynasty 100%
//   SLEEPER all-formats 88.8%
//
// MFL PPR is the floor-setter: it lists the deepest camp tail of the six. 0.65
// leaves it ~12 points of headroom for roster churn while still catching a
// matcher that has half-failed, which 0.5 could not.
export const MINIMUM_MATCH_RATE = 0.65

// Of the rows a feed matched, the share that must carry an average draft
// position. The original rule only fired at EXACTLY zero, which the live Yahoo
// feed walked straight through: on 2026-08-23 it wrote 263 of 466 index rows
// carrying a null ADP and a null percent_drafted -- rows holding nothing at all
// -- and graded PASS every day since 2026-06-29 because 203 rows did carry one.
// Every feed measured that day fills at or near 100%, so a 0.9 floor is well
// clear of healthy and well above the half-empty case it exists to catch.
export const MINIMUM_ADP_FILL_RATE = 0.9

const format_rate = (rate) => `${(rate * 100).toFixed(1)}%`

// Build one feed entry from the rows a feed is about to write. Every counter
// then comes off the SAME collection at the SAME grain, which hand-rolling at
// six call sites did not achieve: the Sleeper importer counted `matched` as
// distinct players and `with_adp` as rows, and reported 8,619 filled out of
// 8,355 matched -- a fill rate above 100%, which no rule can interpret.
// `fetched` stays a caller argument because only the caller knows how many
// players the vendor offered before matching.
export const summarize_adp_feed = ({ label, fetched, rows }) => {
  const filled = rows.filter((row) => row.average_draft_position != null)
  return {
    label,
    fetched,
    matched: rows.length,
    with_adp: filled.length,
    distinct_adp: new Set(filled.map((row) => row.average_draft_position)).size
  }
}

export default function grade_adp_import_run({
  source_id,
  year,
  // [{ label, fetched, matched, with_adp, distinct_adp }] -- one entry per feed
  // the run actually ingested. with_adp counts matched rows carrying a non-null
  // average draft position; omit it and the fill-rate rule is skipped.
  // distinct_adp counts how many DIFFERENT positions those rows hold; omit it
  // and the degenerate-distribution rule is skipped. Both must be counted at
  // the same grain as matched, or their rates are meaningless.
  feeds = [],
  minimum_feed_players = MINIMUM_FEED_PLAYERS,
  minimum_match_rate = MINIMUM_MATCH_RATE,
  minimum_adp_fill_rate = MINIMUM_ADP_FILL_RATE
}) {
  const failures = []

  if (!feeds.length) {
    failures.push('no feeds ingested')
  }

  for (const feed of feeds) {
    const { label, fetched = 0, matched = 0, with_adp, distinct_adp } = feed
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
    // because the rows exist. Fill-rate is the separate assertion, and it has
    // to be a RATE -- a rule that only fires at exactly zero passes a feed that
    // is half empty, which is the state Yahoo shipped in for two months.
    if (with_adp !== undefined) {
      if (with_adp === 0) {
        failures.push(
          `feed ${label} matched ${matched} player(s) but none carried an average draft position`
        )
      } else if (with_adp / matched < minimum_adp_fill_rate) {
        failures.push(
          `feed ${label} adp fill rate ${format_rate(with_adp / matched)} below ${format_rate(minimum_adp_fill_rate)} (${with_adp} of ${matched})`
        )
      }
    }

    // A feed can be complete, fully matched and entirely filled while carrying
    // one repeated sentinel. ESPN's per-season endpoint answers 2025 with
    // averageDraftPosition == 170.00 for all 500 players -- its "undrafted"
    // cap, not a draft position -- and every rule above reads that as healthy.
    // Distinct-value collapse is the only thing that separates a real
    // distribution from a constant.
    if (distinct_adp !== undefined && with_adp > 0 && distinct_adp <= 1) {
      failures.push(
        `feed ${label} carries a single repeated average draft position across ${with_adp} row(s) -- a vendor sentinel, not a distribution`
      )
    }
  }

  const feed_summaries = feeds.map((feed) => {
    const rate = feed.fetched ? feed.matched / feed.fetched : 0
    const with_adp =
      feed.with_adp === undefined ? '' : `, ${feed.with_adp} with adp`
    const distinct_adp =
      feed.distinct_adp === undefined ? '' : `, ${feed.distinct_adp} distinct`
    return `${feed.label}: ${feed.matched}/${feed.fetched} matched (${format_rate(rate)})${with_adp}${distinct_adp}`
  })

  const summary =
    `oracle ${failures.length ? 'FAIL' : 'PASS'}: ` +
    `${source_id} ${year} -- ${feeds.length} feed(s) ingested` +
    (feed_summaries.length ? ` [${feed_summaries.join('; ')}]` : '') +
    (failures.length ? ` -- ${failures.join('; ')}` : '')

  return { passed: failures.length === 0, failures, summary }
}
