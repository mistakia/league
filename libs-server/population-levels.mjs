/*
  Population-level oracles: does a table hold the ROWS it should?

  Every gate in db/gates is a SHAPE oracle -- it checks names, consumers, types
  or SQL validity. All of them are consistent with a table that received a
  fraction of what it claimed, or nothing at all. This repo has shipped that
  failure twice: a rename-broken importer counted every per-player lookup
  failure as `unmatched`, wrote zero rows, exited 0 and reported success daily
  for three weeks; and generate-player-snaps raised 42703 on every run while
  main() swallowed the throw and exited 0. In both cases the exit code and a
  green suite were fully consistent with a table receiving nothing.

  This module is the query half of three registered checks in
  db/checks/registry.mjs. It lives HERE and not in db/gates because the line
  those directories draw is disposition, not subject matter: a gate answers a
  question about a DIFF and a finding must block the push, while a check
  watches a standing condition that can arise with no code change at all, so a
  finding rides a self-closing signal and only a broken detector turns the run
  red. A season that quietly stops loading is the second kind. The same reading
  put percentile-field-resolution in the registry on 2026-09-02.

    population-index-rebuild-parity   each time-series feed's `_index` snapshot
                                      against its own `_history`, SCOPED to the
                                      period history actually covers
    population-season-row-floor       per-season row counts against a floor
                                      derived from PEER SEASONS and anchored on
                                      an independent supply table
    population-identity-resolution    identity-spine resolution rates

  ## What these can and cannot see

    - **Parity is over the row SET, not cell values.** It asserts that
      rebuilding an `_index` from its `_history` would produce the same grain
      keys. A snapshot holding a STALE value at a correct key passes.
    - **Parity claims equality in ONE direction.** An index row with no history
      counterpart is a finding; a history grain the snapshot has rotated out is
      reported and is not. An equality oracle applied to a direction where
      equality was never claimed reports healthy divergence as corruption,
      which is how a sibling's staged gate refused on real data after its
      writer repointed.
    - **Floors cannot reach a season with no completed games.** The anchor is
      `nfl_games`, so the in-progress season is always outside the population,
      as is any season the schedule holds without FINAL statuses.
    - **Nothing here covers PFF charting or college ingest.** Neither exists in
      this database; both are owned by the sibling ingest task.

  ## Why the floors are derived and not written down

  A floor read off the table it is checking passes by construction. A floor
  typed into a file becomes the stale magic number this repo has already
  rejected twice. So each season's expectation comes from the OTHER seasons of
  the same table -- the median rows-per-completed-game over its peers, applied
  to this season's completed-game count. That catches one season loading a
  fraction of what its siblings hold, and because the anchor is an independent
  table it also catches a whole-table truncation, which a bare peer median
  cannot see.
*/

import db from '#db'

// Parity and floor queries scan whole feeds. A query that runs past this is a
// TOOLING failure that must be visible as one -- a timeout swallowed into a
// zero would be the vacuous green these checks exist to prevent.
const STATEMENT_TIMEOUT_MS = 600000

const quote_identifier = (name) => `"${String(name).replace(/"/g, '""')}"`

/**
 * Run one statement under a bounded statement_timeout. SET LOCAL needs a
 * transaction, and a pooled connection is shared, so the bound cannot be set
 * once for the session.
 */
const query_bounded = async (sql, bindings = []) =>
  db.transaction(async (trx) => {
    await trx.raw(`SET LOCAL statement_timeout = ${STATEMENT_TIMEOUT_MS}`)
    const result = await trx.raw(sql, bindings)
    return result.rows
  })

/* -------------------------------------------------------------------------
   Schema derivation. Everything below reads information_schema and pg_index:
   the grain keys of the history/index pairs do NOT share one shape, and
   assuming (pid, week, season_year) would silently mis-key most of them.
   ------------------------------------------------------------------------- */

const load_table_columns = async () => {
  const rows = await query_bounded(`
    SELECT c.table_name, c.column_name, c.is_nullable, c.data_type
    FROM information_schema.columns c
    JOIN pg_class pc ON pc.relname = c.table_name
    JOIN pg_namespace pn ON pn.oid = pc.relnamespace AND pn.nspname = 'public'
    WHERE c.table_schema = 'public'
      AND pc.relkind IN ('r', 'p')
      AND NOT pc.relispartition
  `)
  const by_table = new Map()
  for (const row of rows) {
    if (!by_table.has(row.table_name)) by_table.set(row.table_name, new Map())
    by_table.get(row.table_name).set(row.column_name, {
      nullable: row.is_nullable === 'YES',
      data_type: row.data_type
    })
  }
  return by_table
}

const load_unique_keys = async () => {
  const rows = await query_bounded(`
    SELECT c.relname AS table_name,
      -- attname is of the name type; a name[] has no client-side parser, so it
      -- arrives as an unparsed string and every downstream filter silently
      -- operates on characters. Cast to text[] at the source.
      (SELECT array_agg(a.attname::text ORDER BY k.ord)
       FROM unnest(ix.indkey) WITH ORDINALITY AS k(attnum, ord)
       JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = k.attnum
      ) AS columns
    FROM pg_index ix
    JOIN pg_class c ON c.oid = ix.indrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND ix.indisunique AND ix.indpred IS NULL
      AND c.relkind IN ('r', 'p') AND NOT c.relispartition
  `)
  const by_table = new Map()
  for (const row of rows) {
    if (!row.columns) continue
    if (!by_table.has(row.table_name)) by_table.set(row.table_name, [])
    by_table.get(row.table_name).push(row.columns)
  }
  return by_table
}

/**
 * Pair each time-series feed's history half with its snapshot half, from the
 * table list rather than from a written-down roster -- a feed added after this
 * file was written must appear on its own, and a feed with an unpaired half
 * must surface rather than vanish.
 *
 * Three shapes exist in this schema and all three are derived, not assumed:
 * `x_history` + `x_index`; `x_history` + `x` (the league-format projection
 * values); and `x` + `x_index` (`props`).
 *
 * @param {Set<string>} table_names
 */
export const derive_feed_pairs = (table_names) => {
  const pairs = []
  const paired = new Set()

  for (const name of [...table_names].sort()) {
    if (!name.endsWith('_history')) continue
    const base = name.slice(0, -'_history'.length)
    const index_table = table_names.has(`${base}_index`)
      ? `${base}_index`
      : table_names.has(base)
        ? base
        : null
    if (!index_table) continue
    pairs.push({ feed: base, history_table: name, index_table })
    paired.add(name)
    paired.add(index_table)
  }

  for (const name of [...table_names].sort()) {
    if (!name.endsWith('_index') || paired.has(name)) continue
    const base = name.slice(0, -'_index'.length)
    if (!table_names.has(base)) continue
    pairs.push({ feed: base, history_table: base, index_table: name })
    paired.add(name)
    paired.add(base)
  }

  const unpaired = [...table_names]
    .filter(
      (name) =>
        (name.endsWith('_history') || name.endsWith('_index')) &&
        !paired.has(name)
    )
    .sort()

  return { pairs, unpaired }
}

/**
 * The grain key is the snapshot half's own unique key, intersected with the
 * columns the history half actually has. Two real cases make the intersection
 * necessary rather than pedantic: `props_index` carries a surrogate `prop_id`
 * primary key beside its natural key, and `prop_market_selections_index` keys
 * on a `time_type` that does not exist on the history side at all.
 *
 * Where the snapshot has several unique keys, the one that survives the
 * intersection widest wins, and the columns dropped are reported so a
 * mis-derivation is visible rather than silent.
 */
export const derive_grain = ({
  index_unique_keys,
  history_columns,
  index_columns
}) => {
  const candidates = (index_unique_keys || []).map((columns) => ({
    columns,
    kept: columns.filter((column) => history_columns.has(column)),
    dropped: columns.filter((column) => !history_columns.has(column))
  }))
  if (!candidates.length) return null

  candidates.sort(
    (a, b) =>
      b.kept.length - a.kept.length || a.dropped.length - b.dropped.length
  )
  const best = candidates[0]
  if (!best.kept.length) return null

  // Period columns scope parity to the window history covers. A whole-table
  // check reports a false failure on any feed whose history began mid-life:
  // league_format_player_projection_values_history is exact within its own
  // window and would fail on rows that simply predate the mechanism.
  const period = ['season_year', 'week', 'season_type'].filter(
    (column) =>
      best.kept.includes(column) &&
      history_columns.has(column) &&
      index_columns.has(column)
  )

  return { grain: best.kept, dropped: best.dropped, period }
}

/**
 * Two columns of the same NAME on the two halves of a pair are not necessarily
 * comparable. `props.source_id` is an enum while `props_index.source_id` is an
 * integer, and joining them raises 42883 rather than returning a wrong answer
 * -- which is the good direction, but only if the pair is declared
 * un-gradeable with the reason rather than crashing the run.
 */
const type_family = (data_type) => {
  if (
    [
      'smallint',
      'integer',
      'bigint',
      'numeric',
      'real',
      'double precision'
    ].includes(data_type)
  ) {
    return 'number'
  }
  if (['character varying', 'character', 'text'].includes(data_type)) {
    return 'text'
  }
  if (data_type.startsWith('timestamp') || data_type === 'date') return 'time'
  return data_type
}

export const incompatible_grain_columns = ({
  grain,
  history_columns,
  index_columns
}) =>
  grain
    .map((column) => ({
      column,
      history_type: history_columns.get(column).data_type,
      index_type: index_columns.get(column).data_type
    }))
    .filter(
      (entry) =>
        type_family(entry.history_type) !== type_family(entry.index_type)
    )

/* -------------------------------------------------------------------------
   Index rebuild parity.
   ------------------------------------------------------------------------- */

const join_predicate = ({ columns, left, right, nullable }) =>
  columns
    .map((column) => {
      const operator = nullable.has(column) ? 'IS NOT DISTINCT FROM' : '='
      const identifier = quote_identifier(column)
      return `${left}.${identifier} ${operator} ${right}.${identifier}`
    })
    .join(' AND ')

/**
 * The columns that name a feed's PRODUCER, in preference order. A feed carries
 * at most one of them, and it is the column the reported grain widens on.
 *
 * Written down rather than derived because producer identity is a semantic
 * property and no catalog carries it: `source_id` and `league_format_id` are
 * both just grain columns to information_schema, indistinguishable from `pid`
 * or `week`. What IS derived is whether the feed actually has one -- the name
 * is only used after intersecting it with that feed's own derived grain, so a
 * column of the same name outside the grain is never partitioned on, and a feed
 * with neither reports whole, exactly as it did under the feed-only grain.
 *
 * A feed that later gains a producer column under a third name reports coarse
 * until that name is added here. That is visible in the reported
 * `partition_column`, which is null for exactly the feeds reporting whole.
 */
const PARTITION_COLUMN_CANDIDATES = ['source_id', 'league_format_id']

export const derive_partition_column = ({ grain }) =>
  PARTITION_COLUMN_CANDIDATES.find((column) => grain.includes(column)) ?? null

/**
 * Built as a string rather than through the query builder because every part
 * of it -- table, grain columns, period columns, partition column -- is derived
 * at runtime. Nothing user-supplied reaches it: the identifiers come from
 * information_schema and are quoted.
 *
 * Returns ONE ROW PER PARTITION of the index half, or a single row carrying a
 * null partition where the feed has no producer column. Partitioning is a pure
 * decomposition rather than a different comparison: the partition column is
 * always a grain column, so summing any count over the rows returns exactly
 * what the whole-feed form returned.
 *
 * The row set is keyed on the INDEX side's partitions. A producer present only
 * in history has no index rows to grade -- the invariant is claimed in the
 * index-to-history direction alone -- so it contributes to no row rather than
 * standing as a permanently un-gradeable one. An index half holding no rows at
 * all returns NO rows, which the caller turns into an un-gradeable pair so the
 * feed stays visible.
 */
export const build_parity_sql = ({
  history_table,
  index_table,
  grain,
  period,
  nullable,
  partition_column
}) => {
  const grain_list = grain.map(quote_identifier).join(', ')
  const coverage_clause = period.length
    ? `WHERE EXISTS (SELECT 1 FROM coverage c WHERE ${join_predicate({
        columns: period,
        left: 'c',
        right: 'i',
        nullable
      })})`
    : ''

  // Cast to text so an enum, a uuid and an integer producer all arrive as the
  // same shape: the value becomes half of a grain key that a parked entry has
  // to match as JSON, and a driver-dependent type would make that matching
  // depend on the column's type rather than on its value.
  const partition = partition_column
    ? `${quote_identifier(partition_column)}::text`
    : 'NULL::text'

  return `
    WITH coverage AS (
      SELECT DISTINCT ${
        period.length
          ? period.map(quote_identifier).join(', ')
          : '1 AS unscoped'
      }
      FROM ${quote_identifier(history_table)}
    ),
    hist AS (
      SELECT DISTINCT ${grain_list} FROM ${quote_identifier(history_table)}
    ),
    idx AS (
      SELECT ${grain_list} FROM ${quote_identifier(index_table)} i
      ${coverage_clause}
    ),
    totals AS (
      SELECT ${partition} AS partition_value, count(*) AS index_rows_total
      FROM ${quote_identifier(index_table)} GROUP BY 1
    ),
    scanned AS (
      SELECT ${partition} AS partition_value, count(*) AS index_rows_in_coverage
      FROM idx GROUP BY 1
    ),
    unbacked AS (
      SELECT ${partition} AS partition_value,
        count(*) AS index_rows_missing_from_history
      FROM idx x WHERE NOT EXISTS (
        SELECT 1 FROM hist h WHERE ${join_predicate({
          columns: grain,
          left: 'h',
          right: 'x',
          nullable
        })})
      GROUP BY 1
    ),
    history_totals AS (
      SELECT ${partition} AS partition_value, count(*) AS history_grains
      FROM hist GROUP BY 1
    ),
    history_unbacked AS (
      SELECT ${partition} AS partition_value,
        count(*) AS history_grains_missing_from_index
      FROM hist h WHERE NOT EXISTS (
        SELECT 1 FROM idx x WHERE ${join_predicate({
          columns: grain,
          left: 'x',
          right: 'h',
          nullable
        })})
      GROUP BY 1
    )
    SELECT
      t.partition_value,
      t.index_rows_total,
      coalesce(s.index_rows_in_coverage, 0) AS index_rows_in_coverage,
      coalesce(u.index_rows_missing_from_history, 0) AS index_rows_missing_from_history,
      coalesce(ht.history_grains, 0) AS history_grains,
      coalesce(hu.history_grains_missing_from_index, 0) AS history_grains_missing_from_index
    FROM totals t
    LEFT JOIN scanned s ON s.partition_value IS NOT DISTINCT FROM t.partition_value
    LEFT JOIN unbacked u ON u.partition_value IS NOT DISTINCT FROM t.partition_value
    LEFT JOIN history_totals ht ON ht.partition_value IS NOT DISTINCT FROM t.partition_value
    LEFT JOIN history_unbacked hu ON hu.partition_value IS NOT DISTINCT FROM t.partition_value
    ORDER BY t.partition_value
  `
}

/**
 * One check row from one pair's counts. Separated from the SQL so the controls
 * can drive it with synthetic counts.
 *
 * `numerator` is the violation count and `denominator` is the population
 * SCANNED -- index rows inside history's coverage -- per the registry's
 * denominator contract, so an emptied snapshot is distinguishable from a
 * healthy one on the same field the threshold reads.
 */
export const evaluate_parity = ({
  feed,
  partition_column = null,
  partition_value = null,
  counts
}) => ({
  feed,
  partition_column,
  partition_value,
  numerator: Number(counts.index_rows_missing_from_history),
  denominator: Number(counts.index_rows_in_coverage),
  index_rows_total: Number(counts.index_rows_total),
  index_rows_outside_coverage:
    Number(counts.index_rows_total) - Number(counts.index_rows_in_coverage),
  history_grains: Number(counts.history_grains),
  history_grains_missing_from_index: Number(
    counts.history_grains_missing_from_index
  )
})

/**
 * A feed this run could not compare, emitted with a zero denominator so the
 * classifier reports it UN-GRADEABLE rather than clean. A pair that silently
 * disappeared from the row set would shrink the denominator with nothing to
 * read it.
 */
const ungradeable_pair = ({ feed, reason }) => ({
  feed,
  partition_column: null,
  partition_value: null,
  numerator: 0,
  denominator: 0,
  reason
})

export const index_parity_rows = async () => {
  await assert_population_level_controls()

  const columns_by_table = await load_table_columns()
  const unique_keys = await load_unique_keys()
  const { pairs, unpaired } = derive_feed_pairs(
    new Set(columns_by_table.keys())
  )

  const rows = []

  for (const pair of pairs) {
    const history_columns = columns_by_table.get(pair.history_table)
    const index_columns = columns_by_table.get(pair.index_table)
    const derived = derive_grain({
      index_unique_keys: unique_keys.get(pair.index_table),
      history_columns: new Set(history_columns.keys()),
      index_columns: new Set(index_columns.keys())
    })

    if (!derived) {
      rows.push(
        ungradeable_pair({
          feed: pair.feed,
          reason: `no unique key on ${pair.index_table} intersects ${pair.history_table}; the grain is underivable`
        })
      )
      continue
    }

    const incompatible = incompatible_grain_columns({
      grain: derived.grain,
      history_columns,
      index_columns
    })
    if (incompatible.length) {
      rows.push(
        ungradeable_pair({
          feed: pair.feed,
          reason: incompatible
            .map(
              (entry) =>
                `${entry.column} is ${entry.history_type} on ${pair.history_table} and ${entry.index_type} on ${pair.index_table}`
            )
            .join('; ')
        })
      )
      continue
    }

    const nullable = new Set(
      derived.grain.filter(
        (column) =>
          history_columns.get(column).nullable ||
          index_columns.get(column).nullable
      )
    )

    const partition_column = derive_partition_column({ grain: derived.grain })

    const partitions = await query_bounded(
      build_parity_sql({
        history_table: pair.history_table,
        index_table: pair.index_table,
        grain: derived.grain,
        period: derived.period,
        nullable,
        partition_column
      })
    )

    // An index half holding nothing partitions into nothing, so the feed would
    // leave the row set entirely and read as one fewer pair rather than as an
    // emptied one. The whole point of these checks is that an emptied table
    // must not be indistinguishable from an absent one.
    if (!partitions.length) {
      rows.push(
        ungradeable_pair({
          feed: pair.feed,
          reason: `${pair.index_table} holds no rows to compare`
        })
      )
      continue
    }

    for (const counts of partitions) {
      rows.push({
        ...evaluate_parity({
          feed: pair.feed,
          partition_column,
          partition_value: counts.partition_value,
          counts
        }),
        grain: derived.grain.join(', '),
        period: derived.period.join(', ')
      })
    }
  }

  for (const name of unpaired) {
    rows.push(
      ungradeable_pair({
        feed: name,
        reason: 'a history or index half with no counterpart in the schema'
      })
    )
  }

  return rows
}

/* -------------------------------------------------------------------------
   Per-season row-count floors.
   ------------------------------------------------------------------------- */

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b)
  if (!sorted.length) return null
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2
}

/**
 * A season's expectation comes from its PEERS, never from itself, and is
 * expressed per unit of independent supply so a season with fewer completed
 * games is not judged against one with more.
 *
 * Returns one graded entry per season that HAS a peer-derived expectation, and
 * the rest as `declined` with the reason they carry no floor at all.
 *
 * @param {object} params
 * @param {Array<{ season_year: number, rows: number }>} params.season_rows
 * @param {Map<number, number>} params.supply completed games per season
 */
export const evaluate_season_floors = ({ season_rows, supply }) => {
  const usable = season_rows.filter(({ season_year }) =>
    supply.get(season_year)
  )
  const declined = season_rows
    .filter(({ season_year }) => !supply.get(season_year))
    .map(({ season_year, rows }) => ({
      season_year,
      rows,
      reason:
        'no completed games in nfl_games for this season; no supply anchor'
    }))

  if (usable.length < 3) {
    return {
      graded: [],
      declined: [
        ...declined,
        ...usable.map(({ season_year, rows }) => ({
          season_year,
          rows,
          reason:
            'fewer than 3 anchored seasons in this table; no peer set to derive an expectation from'
        }))
      ]
    }
  }

  const graded = usable.map(({ season_year, rows }) => {
    const peer_ratios = usable
      .filter((peer) => peer.season_year !== season_year)
      .map((peer) => peer.rows / supply.get(peer.season_year))
    const expected_ratio = median(peer_ratios)
    return {
      season_year,
      rows,
      completed_games: supply.get(season_year),
      peer_ratio: Number(expected_ratio.toFixed(3)),
      expected_rows: Math.max(
        1,
        Math.round(expected_ratio * supply.get(season_year))
      )
    }
  })

  return { graded, declined }
}

export const season_floor_rows = async ({ excluded_tables }) => {
  await assert_population_level_controls()

  const columns_by_table = await load_table_columns()

  const supply_rows = await query_bounded(`
    SELECT season_year, count(*) AS completed_games
    FROM nfl_games
    WHERE season_type IN ('REG', 'POST') AND status LIKE 'FINAL%'
    GROUP BY season_year
  `)
  const supply = new Map(
    supply_rows.map((row) => [
      Number(row.season_year),
      Number(row.completed_games)
    ])
  )

  const candidates = [...columns_by_table.entries()]
    .filter(
      ([name, columns]) =>
        columns.has('season_year') &&
        !columns.has('lid') &&
        !excluded_tables[name]
    )
    .map(([name]) => name)
    .sort()

  const rows = []
  for (const table_name of candidates) {
    const season_rows = (
      await query_bounded(
        `SELECT season_year, count(*) AS rows FROM ${quote_identifier(
          table_name
        )} GROUP BY season_year`
      )
    )
      .filter((row) => row.season_year !== null)
      .map((row) => ({
        season_year: Number(row.season_year),
        rows: Number(row.rows)
      }))

    for (const entry of evaluate_season_floors({ season_rows, supply })
      .graded) {
      rows.push({
        table_name,
        season_year: entry.season_year,
        numerator: entry.rows,
        denominator: entry.expected_rows,
        completed_games: entry.completed_games,
        peer_ratio: entry.peer_ratio
      })
    }
  }

  return rows
}

/* -------------------------------------------------------------------------
   Identity-spine resolution rates.
   ------------------------------------------------------------------------- */

/**
 * The NFL identity spine: the player serial, and the two external identifiers
 * the canonical feeds key on. Each probe is a rate over a population that MUST
 * be resolvable -- players with a gamelog in the last completed season, rows in
 * the snap facts for that season -- rather than over the whole table, where a
 * long tail of historical rows would dominate.
 *
 * The season is derived from nfl_games, never hardcoded.
 */
const resolution_probes = (season_year) => [
  {
    probe: 'gsis_player_id on players with a gamelog',
    sql: `
      SELECT count(*) FILTER (WHERE p.gsis_player_id IS NOT NULL) AS numerator,
             count(*) AS denominator
      FROM (SELECT DISTINCT pid FROM player_gamelogs WHERE season_year = ?) g
      JOIN player p ON p.pid = g.pid`
  },
  {
    probe: 'esb_player_id on players with a gamelog',
    sql: `
      SELECT count(*) FILTER (WHERE p.esb_player_id IS NOT NULL) AS numerator,
             count(*) AS denominator
      FROM (SELECT DISTINCT pid FROM player_gamelogs WHERE season_year = ?) g
      JOIN player p ON p.pid = g.pid`
  },
  {
    probe: 'player_gamelogs rows whose pid resolves to a player row',
    sql: `
      SELECT count(*) FILTER (WHERE p.pid IS NOT NULL) AS numerator,
             count(*) AS denominator
      FROM player_gamelogs g LEFT JOIN player p ON p.pid = g.pid
      WHERE g.season_year = ?`
  },
  {
    // nfl_snaps carries no pid of its own: it holds the vendor identifier the
    // feed shipped, and resolution IS the join back to the spine. Asking
    // whether its pid is null would report a perfect rate over a column that
    // does not exist -- as an earlier version of this probe did, raising 42703.
    probe: 'nfl_snaps rows whose gsis_it_player_id resolves to a player',
    sql: `
      SELECT count(*) FILTER (WHERE p.pid IS NOT NULL) AS numerator,
             count(*) AS denominator
      FROM nfl_snaps s
      LEFT JOIN player p ON p.gsis_it_player_id = s.gsis_it_player_id
      WHERE s.season_year = ?`
  },
  {
    probe: 'nfl_games rows carrying an esbid',
    sql: `
      SELECT count(*) FILTER (WHERE esbid IS NOT NULL) AS numerator,
             count(*) AS denominator
      FROM nfl_games WHERE season_year = ?`
  }
]

export const identity_resolution_rows = async () => {
  await assert_population_level_controls()

  const [season] = await query_bounded(`
    SELECT max(season_year) AS season_year FROM nfl_games
    WHERE season_type = 'REG' AND status LIKE 'FINAL%'
  `)
  const season_year = Number(season.season_year)

  const rows = []
  for (const probe of resolution_probes(season_year)) {
    const [row] = await query_bounded(probe.sql, [season_year])
    rows.push({
      probe: probe.probe,
      season_year,
      numerator: Number(row.numerator),
      denominator: Number(row.denominator)
    })
  }
  return rows
}

/* -------------------------------------------------------------------------
   Negative controls.

   These run on EVERY invocation of every check above, and THROW rather than
   report. That is the right disposition here: a control that cannot go red
   means the detector is broken, and a broken detector turns the run red while
   a finding rides a signal.

   They drive the SHIPPED expressions -- the same derivation, the same SQL
   builder, the same evaluators the checks call -- rather than a copy.
   ------------------------------------------------------------------------- */

export const pure_controls = () => {
  const supply = new Map([
    [2021, 285],
    [2022, 285],
    [2023, 285],
    [2024, 285]
  ])
  const healthy_seasons = [2021, 2022, 2023, 2024].map((season_year) => ({
    season_year,
    rows: 285000
  }))
  const gutted_seasons = healthy_seasons.map((entry) =>
    entry.season_year === 2023 ? { ...entry, rows: 900 } : entry
  )
  // A season with a third of the games must NOT come out short: it proves the
  // supply anchor is applied rather than a flat peer count compared directly.
  const short_supply = new Map([...supply, [2024, 95]])
  const short_season = healthy_seasons.map((entry) =>
    entry.season_year === 2024 ? { ...entry, rows: 95000 } : entry
  )
  const rate_of = (seasons, supply_map, season_year) => {
    const entry = evaluate_season_floors({
      season_rows: seasons,
      supply: supply_map
    }).graded.find((graded) => graded.season_year === season_year)
    return entry ? entry.rows / entry.expected_rows : null
  }

  return [
    {
      name: 'parity counts an index row with no history counterpart as a violation',
      went_red:
        evaluate_parity({
          feed: 'control',
          counts: {
            index_rows_total: 100,
            index_rows_in_coverage: 100,
            history_grains: 99,
            index_rows_missing_from_history: 1,
            history_grains_missing_from_index: 0
          }
        }).numerator === 1
    },
    {
      name: 'parity counts no violation for index rows OUTSIDE history coverage',
      went_red:
        evaluate_parity({
          feed: 'control',
          counts: {
            index_rows_total: 767410,
            index_rows_in_coverage: 509040,
            history_grains: 509040,
            index_rows_missing_from_history: 0,
            history_grains_missing_from_index: 0
          }
        }).numerator === 0
    },
    {
      name: 'parity denominator is the scanned population, not the whole index',
      went_red:
        evaluate_parity({
          feed: 'control',
          counts: {
            index_rows_total: 767410,
            index_rows_in_coverage: 509040,
            history_grains: 509040,
            index_rows_missing_from_history: 0,
            history_grains_missing_from_index: 0
          }
        }).denominator === 509040
    },
    {
      name: 'grain derivation drops an index-only key column',
      went_red:
        derive_grain({
          index_unique_keys: [['source_id', 'source_market_id', 'time_type']],
          history_columns: new Set([
            'source_id',
            'source_market_id',
            'observed_at'
          ]),
          index_columns: new Set(['source_id', 'source_market_id', 'time_type'])
        }).dropped.join() === 'time_type'
    },
    {
      name: 'grain derivation prefers the natural key over a surrogate one',
      went_red:
        derive_grain({
          index_unique_keys: [['prop_id'], ['source_id', 'pid', 'week']],
          history_columns: new Set(['source_id', 'pid', 'week', 'observed_at']),
          index_columns: new Set(['prop_id', 'source_id', 'pid', 'week'])
        }).grain.join() === 'source_id,pid,week'
    },
    {
      name: 'pair derivation finds a history half named without the suffix',
      went_red:
        derive_feed_pairs(new Set(['props', 'props_index'])).pairs[0]
          ?.history_table === 'props'
    },
    {
      name: 'pair derivation surfaces an unpaired half',
      went_red:
        derive_feed_pairs(new Set(['orphan_history'])).unpaired.join() ===
        'orphan_history'
    },
    {
      name: 'grain derivation reports a column not comparable across the pair',
      went_red:
        incompatible_grain_columns({
          grain: ['source_id'],
          history_columns: new Map([
            ['source_id', { data_type: 'market_source_id' }]
          ]),
          index_columns: new Map([['source_id', { data_type: 'integer' }]])
        }).length === 1
    },
    {
      name: 'grain derivation accepts smallint against integer',
      went_red:
        incompatible_grain_columns({
          grain: ['season_year'],
          history_columns: new Map([
            ['season_year', { data_type: 'smallint' }]
          ]),
          index_columns: new Map([['season_year', { data_type: 'integer' }]])
        }).length === 0
    },
    {
      name: 'partition derivation finds the producer column a feed does carry',
      went_red:
        derive_partition_column({
          grain: ['pid', 'league_format_id', 'week', 'season_year']
        }) === 'league_format_id'
    },
    {
      name: 'partition derivation reports NO producer column rather than guessing one',
      went_red:
        derive_partition_column({ grain: ['nfl_team', 'season_year'] }) === null
    },
    {
      name: 'floor rate falls below 1 for a season holding a fraction of its peers',
      went_red: rate_of(gutted_seasons, supply, 2023) < 0.5
    },
    {
      name: 'floor rate holds at 1 for a season with proportionally less supply',
      went_red: Math.abs(rate_of(short_season, short_supply, 2024) - 1) < 0.05
    },
    {
      name: 'floor declines a season with no supply anchor rather than grading it',
      went_red:
        evaluate_season_floors({
          season_rows: [...healthy_seasons, { season_year: 2026, rows: 3 }],
          supply
        }).declined.length === 1
    }
  ]
}

/**
 * The one control that drives the SQL rather than an evaluator, which is where
 * the coverage scoping actually lives.
 *
 * It runs the shipped `build_parity_sql` against a synthetic pair of temp
 * tables holding three index rows -- one matched inside coverage, one MISSING
 * inside coverage, and one outside coverage entirely -- then runs it again with
 * the missing row's counterpart present, and asserts the two counts DIFFER.
 *
 * That last assertion is the point. A control that perturbs a row outside the
 * comparison window is vacuous and looks exactly like a control that fired:
 * both runs return the identical count, and nothing in "the run completed"
 * distinguishes them.
 */
export const sql_controls = async () => {
  const sql = build_parity_sql({
    history_table: 'control_history',
    index_table: 'control_index',
    grain: ['season_year', 'pid'],
    period: ['season_year'],
    nullable: new Set(),
    partition_column: null
  })

  // The same corpus read at the widened grain. The unbacked row belongs to
  // producer B and every other row to A, so a build that ignored the partition
  // column returns ONE row carrying the same 1 and fails here -- which is the
  // whole reason this control is a SECOND reading of one corpus rather than a
  // second corpus.
  const partitioned_sql = build_parity_sql({
    history_table: 'control_history',
    index_table: 'control_index',
    grain: ['season_year', 'pid', 'source_id'],
    period: ['season_year'],
    nullable: new Set(),
    partition_column: 'source_id'
  })

  return db.transaction(async (trx) => {
    await trx.raw(`
      CREATE TEMP TABLE control_history (season_year int, pid text, source_id text, observed_at timestamptz)
        ON COMMIT DROP;
      CREATE TEMP TABLE control_index (season_year int, pid text, source_id text) ON COMMIT DROP;
      INSERT INTO control_history VALUES (2025, 'MATCHED', 'A', now()), (2025, 'SNAPSHOTLESS', 'A', now());
      INSERT INTO control_index VALUES (2025, 'MATCHED', 'A'), (2025, 'UNBACKED', 'B'), (2024, 'OUTSIDE', 'A');
    `)

    const [perturbed] = (await trx.raw(sql)).rows
    const partitioned = (await trx.raw(partitioned_sql)).rows
    await trx.raw(
      `INSERT INTO control_history VALUES (2025, 'UNBACKED', 'B', now())`
    )
    const [repaired] = (await trx.raw(sql)).rows
    const partitioned_repaired = (await trx.raw(partitioned_sql)).rows

    const unbacked_by_partition = (rows) =>
      new Map(
        rows.map((row) => [
          row.partition_value,
          Number(row.index_rows_missing_from_history)
        ])
      )
    const partitioned_counts = unbacked_by_partition(partitioned)
    const partitioned_repaired_counts =
      unbacked_by_partition(partitioned_repaired)

    return [
      {
        name: 'parity SQL reports an unbacked index row inside coverage',
        went_red: Number(perturbed.index_rows_missing_from_history) === 1
      },
      {
        name: 'parity SQL excludes the out-of-coverage index row from the comparison',
        went_red:
          Number(perturbed.index_rows_total) === 3 &&
          Number(perturbed.index_rows_in_coverage) === 2
      },
      {
        name: 'parity SQL count DIFFERS between the perturbed and repaired corpus',
        went_red:
          Number(perturbed.index_rows_missing_from_history) !==
          Number(repaired.index_rows_missing_from_history)
      },
      {
        // Equality is claimed in ONE direction only. A history grain the
        // snapshot has rotated out is reported and must not be a violation.
        name: 'parity counts a history grain with no snapshot row as no violation',
        went_red:
          Number(repaired.history_grains_missing_from_index) === 1 &&
          evaluate_parity({ feed: 'control', counts: repaired }).numerator === 0
      },
      {
        name: 'parity SQL separates one producer from another rather than reporting the feed whole',
        went_red:
          partitioned.length === 2 &&
          partitioned_counts.get('A') === 0 &&
          partitioned_counts.get('B') === 1
      },
      {
        name: 'parity SQL partition counts sum to the whole-feed count',
        went_red:
          [...partitioned_counts.values()].reduce(
            (total, count) => total + count,
            0
          ) === Number(perturbed.index_rows_missing_from_history)
      },
      {
        name: 'parity SQL partition count DIFFERS on the repaired corpus for the producer that owned the violation',
        went_red:
          partitioned_repaired_counts.get('B') === 0 &&
          partitioned_repaired_counts.get('B') !== partitioned_counts.get('B')
      },
      {
        name: 'parity SQL scopes a partition to history coverage, not the whole index',
        went_red:
          Number(
            partitioned.find((row) => row.partition_value === 'A')
              .index_rows_total
          ) === 2 &&
          Number(
            partitioned.find((row) => row.partition_value === 'A')
              .index_rows_in_coverage
          ) === 1
      }
    ]
  })
}

export const assert_population_level_controls = async () => {
  const controls = [...pure_controls(), ...(await sql_controls())]
  const stayed_green = controls.filter((control) => !control.went_red)
  if (stayed_green.length) {
    throw new Error(
      `population-level negative controls STAYED GREEN, so these checks cannot report: ${stayed_green
        .map((control) => control.name)
        .join('; ')}`
    )
  }
  return controls
}
