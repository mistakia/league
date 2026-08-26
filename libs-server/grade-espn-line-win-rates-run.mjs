// Output oracle for scripts/import-espn-line-win-rates.mjs.
//
// The importer declared success on "main() did not throw" plus two aggregate
// row-count floors, which between them could not see any of the three ways this
// feed actually broke:
//
//   1. WRONG SEASON. `espn_line_win_rates_url` is a season-pinned ESPN article
//      (.../id/46138675/2025-nfl-win-rates-...), but the row's season_year came
//      from the clock. Four runs in March 2026 scraped the 2025 article and
//      wrote it as season_year 2026 -- 32 team rows and 108 player rows of a
//      season that had not been played. Both floors passed; the values were
//      near-identical to the 2025 rows they duplicated.
//   2. COARSE GRAIN. One floor of 50 covered all four player categories
//      summed. RUN_STOP and RUN_BLOCK run 19-20 rows each, so either could
//      collapse to zero and the other three would still clear 50 -- the
//      per-week/per-game lesson from import-plays-nflfastr, one level up.
//   3. NOTHING GRADED THE VALUES. Row count says nothing about whether the
//      cells parsed. `parse_percentage` read `/(\d+)%/`, which matches "5%"
//      inside "62.5%" and yields 0.05 -- populated, wrong, and invisible to
//      any presence or count rule. The distinct-value and range rules below
//      are what catch that class.
//
//   4. UNMATCHED PLAYERS WERE DROPPED, AND SO WAS THE EVIDENCE THEY EXISTED.
//      A player the importer could not resolve to a pid had their row discarded
//      before insert, which lost the published leaderboard entry AND the
//      denominator that would have said how many were lost. The 2025 season's
//      final observation wrote 108 rows against the 120 ESPN published, and
//      nothing in the run said so. Rows are now kept with a null pid and every
//      miss is named -- see MATCHING IS GRADED AT 100% below.
//
// Grain: per FEED. The team table and each of the four player categories are
// graded on their own, because that is the grain at which this page breaks --
// ESPN restructures one table at a time.
//
// Pure: takes counters the run already keeps and returns a verdict plus the
// line to print, so the caller decides how to surface it. Every calibrated
// bound is injectable, so the spec can drive real behaviour rather than fight
// production-scale constants.

// ESPN's team table lists every NFL team, always. This is a structural
// invariant rather than a calibrated floor: a table with 31 teams is a parse
// failure, not a quiet week.
export const EXPECTED_TEAM_COUNT = 32

// Per-category player floor, measured from espn_player_win_rates_history on
// league_production (2026-08-25). Rows written per run, per category:
//
//   PASS_RUSH  38-40 | PASS_BLOCK 32-40 | RUN_STOP 19-20 | RUN_BLOCK 19-20
//
// ESPN publishes a leaders and a laggards table per category; the run/stop and
// run/block pairs are the smaller ones and set the floor. Healthy minimum is
// 19, parse collapse is 0-2, so 10 splits the gap with room on both sides.
export const MINIMUM_CATEGORY_PLAYERS = 10

// MATCHING IS GRADED AT 100%, AND THERE IS DELIBERATELY NO THRESHOLD.
//
// A match-rate floor is a decision to keep losing whoever falls under it. Set it
// at 0.8 and the four players who never resolve are permanently invisible: the
// run goes green, nobody is named, and the same four are dropped every week for
// as long as the feed exists. A floor set from a measured rate is worse, because
// it launders the residual into a number that looks like evidence.
//
// So every published row must resolve to a pid, and any that does not fails the
// run BY NAME. The residual is small and finite -- it has been three players
// with a fixable cause (a missing espn_player_id plus a legal name ESPN does not
// use) -- and naming them is what makes it fixable rather than permanent.
//
// This is affordable only because an unmatched row is no longer DROPPED. The
// importer writes it with a null pid, so the published leaderboard and the
// denominator both survive, and the failure is about the missing identity link
// rather than about missing data. See the data/match split in the grader below.

// Win rates are percentages in [0, 1] after parsing. Every rate ESPN has ever
// published for these metrics sits between 0.19 and 0.85; the bound here is
// deliberately looser than the observed range because its job is to catch a
// decimal-place error (0.05 for 62.5%, or 62.5 for an unscaled read), not to
// police the distribution.
export const MINIMUM_PLAUSIBLE_RATE = 0.05
export const MAXIMUM_PLAUSIBLE_RATE = 0.99

const format_rate = (rate) => `${(rate * 100).toFixed(1)}%`

// Derive the season the page is ABOUT from the URL it was fetched from.
// `espn_line_win_rates_url` is a per-season ESPN article whose slug carries the
// year, so the season is a property of the source and never of the clock. A URL
// that does not carry one returns null, which the grader treats as a failure --
// an unrecognized URL shape means we no longer know what season we just wrote.
//
// Anchored on `<year>-nfl-` rather than on the rest of the slug, because ESPN
// has renamed the article twice in six seasons and only the year prefix has
// survived both:
//
//   2020-2022  <year>-nfl-pass-rushing-run-stopping-blocking-leaderboard-...
//   2023       <year>-nfl-pass-rush-run-stop-blocking-win-rate-rankings-...
//   2024-2025  <year>-nfl-win-rates-top-teams-players-rankings...
//
// Matching on `-nfl-win-rates` would have covered only the two most recent
// namings and returned null for every earlier one -- fail-loud rather than
// silently wrong, but a needless outage the next time ESPN renames.
export const parse_season_year_from_url = (url) => {
  const match = String(url || '').match(/\/(20\d{2})-nfl-/)
  return match ? Number(match[1]) : null
}

// Build one feed entry from the rows a feed is about to write, so every counter
// comes off the SAME collection at the SAME grain.
//
// `rows` is now every row the page LISTED, matched or not, which is what lets
// `fetched` be derived here rather than tracked by the caller in a parallel
// counter. That parallel counter existed only because unmatched rows were
// dropped from `rows` before this was called, and a denominator kept apart from
// the collection it describes is a denominator that drifts from it.
//
// `unmatched` carries the DESCRIPTORS of the rows with no pid, not just a count,
// because the whole point of grading matching at 100% is naming who is missing.
export const summarize_win_rate_feed = ({
  label,
  rows,
  rate_key,
  unmatched = []
}) => {
  const rates = rows
    .map((row) => row[rate_key])
    .filter((rate) => rate != null && !Number.isNaN(rate))
  return {
    label,
    fetched: rows.length,
    matched: rows.length - unmatched.length,
    unmatched,
    with_rate: rates.length,
    distinct_rates: new Set(rates).size,
    min_rate: rates.length ? Math.min(...rates) : null,
    max_rate: rates.length ? Math.max(...rates) : null
  }
}

export default function grade_espn_line_win_rates_run({
  // The season derived from the source URL, and the season the run was
  // expected to be importing. These must agree: they are the whole defense
  // against a season-pinned URL that nobody updated when the season rolled.
  source_season_year,
  expected_season_year,
  source_url,
  // [{ label, fetched, matched, with_rate, distinct_rates, min_rate, max_rate }]
  feeds = [],
  expected_team_count = EXPECTED_TEAM_COUNT,
  minimum_category_players = MINIMUM_CATEGORY_PLAYERS,
  minimum_plausible_rate = MINIMUM_PLAUSIBLE_RATE,
  maximum_plausible_rate = MAXIMUM_PLAUSIBLE_RATE
}) {
  // TWO KINDS OF FAILURE, BECAUSE THEY WANT DIFFERENT REMEDIES.
  //
  // `data_failures` mean the numbers themselves are wrong or unknown -- the
  // wrong season, a collapsed table, a percentage read at the wrong scale. Rows
  // like that must not reach the tables at all, so these block the write.
  //
  // `match_failures` mean the numbers are RIGHT and one identity link is
  // missing. Refusing to write on those would discard a correct leaderboard
  // over a rookie who has no espn_player_id on his player row yet, and would
  // reintroduce the drop-the-row behaviour one level up. So they do not block
  // the write -- the rows land with a null pid -- but they still fail the run,
  // which is what puts the names in front of someone.
  const data_failures = []
  const match_failures = []

  if (source_season_year == null) {
    data_failures.push(
      `could not derive a season from espn_line_win_rates_url (${source_url}) -- the article slug no longer carries one, so the season this run wrote is unknown`
    )
  } else if (source_season_year !== expected_season_year) {
    // The March 2026 incident, made loud. ESPN publishes a new article each
    // season and the config row has to be repointed at it; until someone does,
    // the old article keeps serving last season's final numbers.
    data_failures.push(
      `espn_line_win_rates_url is the ${source_season_year} article but this run is importing ${expected_season_year} -- repoint config.espn_config.espn_line_win_rates_url at the ${expected_season_year} article`
    )
  }

  if (!feeds.length) {
    data_failures.push('no feeds ingested')
  }

  for (const feed of feeds) {
    const {
      label,
      fetched = 0,
      matched = 0,
      unmatched = [],
      with_rate,
      distinct_rates,
      min_rate,
      max_rate,
      is_team_feed = false
    } = feed

    if (fetched === 0) {
      // "Produced nothing" and "had nothing to produce" must not share an
      // outcome. This page is never legitimately empty inside the window the
      // job runs, so zero rows is a restructured table, not a quiet week.
      data_failures.push(`feed ${label} returned 0 rows`)
      continue
    }

    if (is_team_feed) {
      if (fetched !== expected_team_count) {
        data_failures.push(
          `feed ${label} returned ${fetched} team(s), expected exactly ${expected_team_count}`
        )
      }
    } else if (fetched < minimum_category_players) {
      data_failures.push(
        `feed ${label} returned only ${fetched} player(s) (floor ${minimum_category_players})`
      )
    }

    if (matched === 0) {
      data_failures.push(`feed ${label} matched 0 of ${fetched} row(s)`)
      continue
    }

    // Every published row must resolve to a pid, and the ones that do not are
    // named. No threshold -- see the MATCHING IS GRADED AT 100% note above.
    if (matched < fetched) {
      const named = unmatched.length ? `: ${unmatched.join(', ')}` : ''
      match_failures.push(
        `feed ${label} matched ${matched} of ${fetched} row(s) -- ${fetched - matched} published player(s) have no pid${named}`
      )
    }

    // Rows can be written and carry nothing: a renamed column or a moved cell
    // index parses to null for every entry, which any presence check reads as
    // healthy because the rows exist. Every feed on this page fills at 100%,
    // so anything short of complete is a parse fault.
    //
    // Graded against FETCHED rather than matched, because an unmatched row is
    // written now rather than dropped, and it carries a win rate like any other.
    // Comparing against matched would let a null rate hide behind a null pid.
    if (with_rate !== undefined && with_rate < fetched) {
      data_failures.push(
        `feed ${label} carried ${fetched} row(s) but only ${with_rate} carried a win rate`
      )
    }

    // A feed can be complete, fully matched and fully populated while carrying
    // one repeated sentinel. Distinct-value collapse is the only rule that
    // separates a real distribution from a constant.
    if (distinct_rates !== undefined && with_rate > 0 && distinct_rates <= 1) {
      data_failures.push(
        `feed ${label} carries a single repeated win rate across ${with_rate} row(s) -- a sentinel or a dead cell, not a distribution`
      )
    }

    // Range, which is what catches a decimal-place fault. A regex that reads
    // "5" out of "62.5%" produces a perfectly well-formed distribution of
    // wrong numbers, and every rule above passes it.
    if (min_rate != null && min_rate < minimum_plausible_rate) {
      data_failures.push(
        `feed ${label} minimum win rate ${min_rate} is below ${minimum_plausible_rate} -- suspect a percentage parsed at the wrong scale`
      )
    }
    if (max_rate != null && max_rate > maximum_plausible_rate) {
      data_failures.push(
        `feed ${label} maximum win rate ${max_rate} is above ${maximum_plausible_rate} -- suspect a percentage parsed at the wrong scale`
      )
    }
  }

  const feed_summaries = feeds.map((feed) => {
    const rate = feed.fetched ? feed.matched / feed.fetched : 0
    const distinct =
      feed.distinct_rates === undefined
        ? ''
        : `, ${feed.distinct_rates} distinct`
    const range =
      feed.min_rate == null ? '' : `, range ${feed.min_rate}-${feed.max_rate}`
    return `${feed.label}: ${feed.matched}/${feed.fetched} matched (${format_rate(rate)})${distinct}${range}`
  })

  // Data failures first, so the reason the rows were refused leads the line
  // rather than trailing a list of names.
  const failures = [...data_failures, ...match_failures]

  const summary =
    `oracle ${failures.length ? 'FAIL' : 'PASS'}: ` +
    `espn line win rates ${source_season_year ?? 'unknown'} -- ${feeds.length} feed(s) ingested` +
    (feed_summaries.length ? ` [${feed_summaries.join('; ')}]` : '') +
    (failures.length ? ` -- ${failures.join('; ')}` : '')

  return {
    passed: failures.length === 0,
    failures,
    data_failures,
    match_failures,
    // The caller writes when the DATA is sound, and fails the run afterwards if
    // identity links are missing. Named on the verdict rather than recomputed at
    // the call site, so the two cannot drift apart.
    write_blocked: data_failures.length > 0,
    summary
  }
}
