import db from '#db'

// A prop market and its selections are written by one importer pass, but they
// land in two tables and only one of them is load-bearing for readers.
// `prop_markets_index` holds the market HEADER — the book, the game, the market
// type, and `selection_count`, the number of runners the BOOK said it was
// offering. `prop_market_selections_index` holds the priced rungs. Every
// consumer inner-joins the selections, so a market whose selections never
// landed contributes nothing and reads exactly like a market the book never
// posted.
//
// That makes `selection_count` the oracle, and it is the only one available.
// It is the book's own declaration, carried on the header we did store, so a
// header declaring runners against zero stored selections is self-evidently a
// capture failure rather than an absent market. Nothing else can tell the two
// apart: the importers report per-run success on runs that DID happen, the
// market header lands either way, and a count over `prop_markets_index` alone
// reads healthy because the header is exactly what survived.
//
// Discovered 2026-09-02 through a line-axis data view that rendered 15 of 18
// weeks for one player. Two of the three missing weeks were games FanDuel had
// posted an eleven-rung ladder for, whose selections are in neither the index
// nor `prop_market_selections_history`.
//
// GRADED AS A RATE, per (source_id, season_year). The loss is not per-book or
// per-market-type but scattered across both, so a count budget over the whole
// check would be spent by one bad book while a second went silent unnoticed.
// A per-book-per-season ratio isolates the unit that actually fails: an
// importer, for a season.
//
// The denominator counts only markets DECLARING selections. A header with
// `selection_count` of zero is a market the book listed and priced nothing on,
// which is a legitimate state and not this check's subject.
//
// Keyed on (source_id, source_market_id, time_type) because that triple is the
// market identity both tables share — `time_type` included, since OPEN and
// CLOSE are separate observations of one market and a book can capture one
// while losing the other.

/**
 * Per-book, per-season share of declared prop markets whose selections landed.
 *
 * @returns {Promise<Array<object>>} rows carrying the grain plus numerator and denominator
 */
export const prop_market_selection_coverage_rows = async () => {
  // Expressed as two DISTINCT sets hash-joined rather than as a correlated
  // EXISTS. The EXISTS form is the obvious spelling and it does not finish:
  // measured 2026-09-02, it exceeded the 40s statement timeout, while this form
  // returns in 11.4s over the same corpus. The planner probes the selections
  // index once per market under EXISTS and hashes it once here.
  const rows = await db
    .with('declared', (qb) => {
      qb.distinct('source_id', 'season_year', 'source_market_id', 'time_type')
        .from('prop_markets_index')
        .where('selection_count', '>', 0)
        .whereNotNull('season_year')
    })
    .with('stored', (qb) => {
      qb.distinct('source_id', 'source_market_id', 'time_type').from(
        'prop_market_selections_index'
      )
    })
    .select('declared.source_id', 'declared.season_year')
    .count('* as denominator')
    .count('stored.source_market_id as numerator')
    .from('declared')
    .leftJoin('stored', function () {
      this.on('stored.source_id', '=', 'declared.source_id')
        .andOn('stored.source_market_id', '=', 'declared.source_market_id')
        .andOn('stored.time_type', '=', 'declared.time_type')
    })
    .groupBy('declared.source_id', 'declared.season_year')

  return rows.map((/** @type {Record<string, any>} */ row) => ({
    source_id: row.source_id,
    season_year: Number(row.season_year),
    numerator: Number(row.numerator),
    denominator: Number(row.denominator)
  }))
}
