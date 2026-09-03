import db from '#db'

// One priced rung of one market, offered by one book on one game, should exist
// once. `prop_markets_index` is unique on (source_id, source_market_id,
// time_type), and `source_market_id` is the BOOK'S handle rather than an
// identity we control, so when a book issues a second id for a market it is
// already offering, every row under the new id is a fresh insert and both
// keyings survive as concurrent observations of one real rung.
//
// Nothing else here sees it. The importers report per-run success for runs that
// happened, both keyings are individually well-formed, and
// prop-market-selection-coverage reads HEALTHIER when this fires, because the
// duplicate market carries its own selections and so counts as covered. The
// defect surfaced 2026-09-03 through a data view rendering one ladder rung
// twice at two prices, and neither 2025 incident raised anything.
//
// GRADED AS A RATE, per (source_id, season_year), for the same reason the
// coverage check is: the failing unit is one book's importer for one season,
// and a count budget over the whole check would be spent by DraftKings 2025
// while a second book went silent.
//
// THE POPULATION EXCLUDES EVERY NULL GRAIN FIELD, and that is the load-bearing
// decision in this module rather than a hygiene detail. SQL's `group by` treats
// NULL as equal to NULL, so a grain column that is null does not merely weaken
// the key -- it MERGES rows the key was supposed to separate, and every merged
// pair then reports as a duplicate. Both traps are live in this corpus and both
// were measured 2026-09-03:
//
//   - `market_type` is null on 77 percent of DraftKings markets, and grouping
//     those together reported "Alt Spread 1st Quarter" and "Alt Spread 1st
//     Half" as one duplicated rung. Including nulls inflated DraftKings 2025
//     from 15,249 duplicated keys to 88,513.
//   - `selection_metric_line` is null on 232,137 of Caesars 2024's 232,151 alt
//     selection rows, so that book-season's whole ladders collapsed to one key
//     each and reported 40,628 duplicates. That is a real defect -- the line
//     never parsed -- but it is a DIFFERENT one, and it belongs to whatever
//     owns Caesars 2024's alt ladder parsing rather than here.
//
// A rung whose market type or line is unknown is a rung this check cannot
// identify, so it is outside the population rather than inside it as a
// violation. What is lost with that is worth naming: a book that re-keys a
// market whose line never parsed is invisible here, and only the line defect
// itself will surface it.

/**
 * Per-book, per-season share of prop-market rungs carried under exactly one
 * `source_market_id`.
 *
 * @returns {Promise<Array<object>>} rows carrying the grain plus numerator and denominator
 */
export const prop_market_rung_duplication_rows = async () => {
  // The inner aggregate is a DISTINCT over the rung grain plus the market id,
  // not a raw join projection. A rung legitimately carries several selection
  // rows under one market id (a book re-posting the same runner), and counting
  // rows rather than distinct ids would report that as duplication.
  const { rows } = await db.raw(`
    with rung as (
      select
        m.source_id,
        m.season_year,
        m.esbid,
        m.market_type,
        m.time_type,
        s.selection_pid,
        s.selection_metric_line,
        s.selection_type,
        m.source_market_id
      from prop_markets_index m
      join prop_market_selections_index s
        on s.source_id = m.source_id
       and s.source_market_id = m.source_market_id
       and s.time_type = m.time_type
      where m.season_year is not null
        and m.esbid is not null
        and m.market_type is not null
        and s.selection_pid is not null
        and s.selection_metric_line is not null
      group by 1, 2, 3, 4, 5, 6, 7, 8, 9
    ),
    keyed as (
      select
        source_id,
        season_year,
        count(*) as market_id_count
      from rung
      group by
        source_id,
        season_year,
        esbid,
        market_type,
        time_type,
        selection_pid,
        selection_metric_line,
        selection_type
    )
    select
      source_id,
      season_year,
      count(*) as denominator,
      count(*) filter (where market_id_count = 1) as numerator
    from keyed
    group by source_id, season_year
  `)

  return rows.map((/** @type {Record<string, any>} */ row) => ({
    source_id: row.source_id,
    season_year: Number(row.season_year),
    numerator: Number(row.numerator),
    denominator: Number(row.denominator)
  }))
}
