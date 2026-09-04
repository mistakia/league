import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import { transaction_types } from '#constants'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const RESET_LIST_PATH = path.join(
  __dirname,
  '..',
  'db',
  'fixtures',
  'reset-league-tables.mjs'
)

/**
 * The league-scoped table list, parsed from the fixture reset list.
 *
 * DERIVED, NOT RESTATED. `db/fixtures/reset-league-tables.mjs` is the canonical
 * enumeration of what belongs to a league, and it already carries a coverage
 * gate that fails when a new league-scoped table is not cleared. Reading it here
 * means a table added tomorrow is wiped by this script with no edit -- a second
 * hand-maintained list is the exact defect the single reset list was created to
 * remove, and it would have no gate on it.
 *
 * The regex matches db/gates/check-league-fixture-reset-coverage.mjs's
 * `parse_reset_list`. It is duplicated rather than imported because that file is
 * a gate SCRIPT -- importing it executes the whole gate. A spec asserts the two
 * parses agree, so the duplication cannot drift silently.
 */
export const parse_league_scoped_tables = (source) => {
  const stripped = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
  const out = []
  const re = /(?:knex|db|trx)\(\s*['"](\w+)['"]\s*\)\s*\.del\(\)/g
  let match
  while ((match = re.exec(stripped)) !== null) out.push(match[1])
  return out
}

export const LEAGUE_SCOPED_TABLES = parse_league_scoped_tables(
  fs.readFileSync(RESET_LIST_PATH, 'utf8')
)

// The two scoping vocabularies this schema actually uses, in the same order and
// with the same both-spellings-are-live reasoning as the coverage gate's
// DIRECT_SCOPE_COLUMNS. Split into two tiers here because the gate only has to
// decide WHETHER a table is league-scoped, while this file has to build the
// predicate: a league column compares to the lid, a team column has to go
// through `teams`.
const LEAGUE_SCOPE_COLUMNS = ['lid', 'league_id']
const TEAM_SCOPE_COLUMNS = ['tid', 'team_id']

/**
 * The parent a grandchild table is scoped THROUGH, or null.
 *
 * Five of the reset list's tables carry no league or team column at all --
 * `waiver_releases`, `poach_releases`, `trades_transactions`,
 * `restricted_free_agency_releases` and `admission_vote_candidates`. They are
 * scoped through a parent ROW ID, which is the coverage gate's tier 2, so the
 * derivation is the same one: a column `<X>_id` where `<X>` pluralizes to a
 * table already known league-scoped.
 *
 * The parent's own key is NOT always spelled the same as the child's column --
 * `restricted_free_agency_releases.restricted_free_agency_bid_id` points at
 * `restricted_free_agency_bids.bid_id`. So the key is resolved against the
 * parent's real columns, longest suffix first, and an unresolvable one throws
 * rather than silently scoping to nothing.
 */
export const parent_table_for = ({ column, table, scoped_tables }) => {
  const match = column.match(/^(.*?)_?id$/)
  if (!match || !match[1]) return null
  const stem = match[1]
  for (const candidate of [`${stem}s`, `${stem}es`]) {
    if (candidate !== table && scoped_tables.includes(candidate)) {
      return candidate
    }
  }
  return null
}

export const parent_key_for = ({ column, parent_columns }) => {
  if (parent_columns.includes(column)) return column
  const suffix_matches = parent_columns
    .filter((candidate) => column.endsWith(candidate))
    .sort((a, b) => b.length - a.length)
  return suffix_matches[0] || null
}

/**
 * How one table's rows are narrowed to one league.
 *
 * Pure: it takes the columns rather than reading them, so a spec can drive it
 * with a synthetic schema and see each tier chosen for a reason it controls.
 */
export const resolve_scope = ({
  table,
  columns,
  scoped_tables,
  columns_by_table = {}
}) => {
  const league_column = LEAGUE_SCOPE_COLUMNS.find((c) => columns.includes(c))
  if (league_column) return { tier: 'league', column: league_column }

  const team_column = TEAM_SCOPE_COLUMNS.find((c) => columns.includes(c))
  if (team_column) return { tier: 'team', column: team_column }

  for (const column of columns) {
    const parent = parent_table_for({ column, table, scoped_tables })
    if (!parent) continue
    const parent_key = parent_key_for({
      column,
      parent_columns: columns_by_table[parent] || []
    })
    if (!parent_key) {
      throw new Error(
        `${table}.${column} points at ${parent}, which has no column it could key on`
      )
    }
    return { tier: 'parent', column, parent, parent_key }
  }

  throw new Error(`cannot scope ${table} to a league: no key of any tier`)
}

const columns_of = async ({ trx, table }) =>
  Object.keys(await trx(table).columnInfo())

/**
 * Resolve every league-scoped table's predicate once, against the LIVE schema.
 *
 * Reading columns from the database rather than from the committed schema dump
 * is deliberate: this script runs against a real database, and a dump that has
 * drifted from it would produce a wipe that misses rows while reporting none.
 */
export const build_scope_plan = async ({
  trx,
  tables = LEAGUE_SCOPED_TABLES
}) => {
  const columns_by_table = {}
  for (const table of tables) {
    columns_by_table[table] = await columns_of({ trx, table })
  }

  const plan = {}
  for (const table of tables) {
    plan[table] = resolve_scope({
      table,
      columns: columns_by_table[table],
      scoped_tables: tables,
      columns_by_table
    })
  }
  return plan
}

const scoped_query = ({ trx, table, lid, plan }) => {
  const entry = plan[table]
  const query = trx(table)

  if (entry.tier === 'league')
    return query.where(`${table}.${entry.column}`, lid)

  if (entry.tier === 'team') {
    return query.whereIn(
      `${table}.${entry.column}`,
      trx('teams').distinct('team_id').where('lid', lid)
    )
  }

  return query.whereIn(
    `${table}.${entry.column}`,
    scoped_query({ trx, table: entry.parent, lid, plan }).select(
      `${entry.parent}.${entry.parent_key}`
    )
  )
}

/**
 * Row counts per league-scoped table, for one league.
 *
 * This is the oracle for the source-is-unwritten assertion, so it deliberately
 * covers the WHOLE derived table set rather than the small set a clone copies:
 * a defect that wrote the source would most likely write a table the copy never
 * touches, and a narrow count would report clean.
 */
export const count_league_rows = async ({ trx, lid, plan }) => {
  const resolved = plan || (await build_scope_plan({ trx }))
  const counts = {}
  for (const table of Object.keys(resolved)) {
    const [row] = await scoped_query({ trx, table, lid, plan: resolved }).count(
      '* as count'
    )
    counts[table] = Number(row.count)
  }
  return counts
}

export const diff_counts = (before, after) =>
  Object.keys(before)
    .filter((table) => before[table] !== after[table])
    .map((table) => `${table}: ${before[table]} -> ${after[table]}`)

/**
 * What a clone actually copies, and why it is NOT the full list above.
 *
 * The wipe is complete by construction; the COPY is deliberately small and
 * reviewed. Trade, waiver, poach, RFA and governance history has no bearing on
 * an auction, and copying it means remapping every surrogate id a sequence hands
 * out -- a clone that gets that subtly wrong is worse than one that never
 * claims to have done it.
 *
 * `transactions` is in the set for a reason that is easy to miss: `getRoster`
 * INNER JOINs it to source each rostered player's salary, because
 * `rosters_players` carries no value column. Omit it and every rostered player
 * silently disappears from the cloned roster and the cap arithmetic is wrong.
 *
 * `users_teams` is copied but NOT copied WHOLE -- it is narrowed to the target
 * league's commissioner, so a clone enrolls nobody who did not create it. See
 * clone_league_board.
 */
export const CLONED_BOARD_TABLES = [
  'teams',
  'users_teams',
  'rosters',
  'rosters_players',
  'transactions'
]

/**
 * Tables a clone deliberately leaves empty, with the reason, so that a later
 * reader does not read the absence as an oversight.
 */
export const NOT_CLONED_REASONS = {
  trades:
    'trade history has no bearing on an auction and its children need id remapping',
  waivers:
    'waiver history is irrelevant to an auction and its releases are grandchildren',
  poaches: 'same',
  admission_votes:
    'governance history, unrelated, four child tables keyed on the vote id',
  draft: 'the rookie draft precedes free agency and does not affect the board'
}

/**
 * Move a table's id sequence past the largest id already in it.
 *
 * EVERY id this clone draws needs this first, and the reason is not tidiness.
 * A row inserted with an EXPLICIT id does not advance the sequence behind that
 * column, so any such insert leaves the sequence pointing at an id that already
 * exists. The next `nextval` then collides on the primary key and aborts the
 * whole clone transaction partway through.
 *
 * This is not hypothetical and it is not test-only. `--sync` re-inserts the
 * `leagues` row and every team's second-and-later season rows under explicit
 * ids; the league fixture creates league 1 and its twelve teams that way; a
 * bulk import does the same. Production's four sequences happened to be in sync
 * when this was written, which is exactly the condition that makes the failure
 * arrive later and look like corruption rather than drift.
 *
 * Only ever moves the sequence FORWARD. Setting it back to `max(id)` would be
 * the more obvious spelling and is wrong: a sequence legitimately ahead of the
 * table -- ids drawn by a concurrent transaction, or by rows since deleted --
 * would be rewound to hand those ids out a second time.
 */
const reconcile_sequence = async ({ trx, table, column }) => {
  await trx.raw(
    `SELECT setval(
       pg_get_serial_sequence(?, ?),
       GREATEST(
         (SELECT COALESCE(MAX(??), 1) FROM ??),
         COALESCE(pg_sequence_last_value(pg_get_serial_sequence(?, ?)), 1)
       )
     )`,
    [table, column, column, table, table, column]
  )
}

// Rows per INSERT. The copy's cost is round trips, not work: league 1 carries
// 12,195 transactions and 587 roster players, and one insert per row against a
// remote database took 26 minutes end to end -- during which the script printed
// nothing at all, so the operator could not tell it from a hang and killed it.
// This repository's own rule is that a run silent for more than a minute should
// be TREATED as a hang, so the script was requiring the operator to break it.
//
// 500 keeps each statement well inside postgres's 65535 bind-parameter ceiling
// for the widest table here, and turns ~12,900 round trips into ~30.
const INSERT_BATCH_SIZE = 500

/**
 * Insert rows in batches, reporting progress as it goes.
 *
 * Deliberately NOT knex's `batchInsert`: that opens its own transaction unless
 * handed one, and the whole clone must live or die inside the caller's single
 * transaction. Chunking the caller's `trx` keeps that guarantee.
 *
 * Returns the number of rows inserted, so the caller cannot report a count it
 * did not verify.
 */
const insert_in_batches = async ({
  trx,
  table,
  rows,
  on_progress = () => {}
}) => {
  on_progress({ table, copied: 0, total: rows.length })
  let copied = 0
  for (let index = 0; index < rows.length; index += INSERT_BATCH_SIZE) {
    const batch = rows.slice(index, index + INSERT_BATCH_SIZE)
    await trx(table).insert(batch)
    copied += batch.length
    on_progress({ table, copied, total: rows.length })
  }
  return copied
}

const refuse_league_one = (lid, verb) => {
  if (Number(lid) === 1) {
    throw new Error(
      `refusing to ${verb} league 1: that is the live league running the real auction`
    )
  }
}

/**
 * The order the tables must be cleared in, which is NOT the reset list's order.
 *
 * The reset list runs PARENT BEFORE CHILD -- `waivers` then `waiver_releases`,
 * `poaches` then `poach_releases`, `trades` then `trades_transactions` -- and
 * that is right for it, because it deletes whole tables and only has to respect
 * the two real foreign keys. Here the delete is SCOPED, and a grandchild with no
 * league key of its own is reached through a subquery on its parent. Clearing
 * the parent first empties that subquery, so the grandchild matches nothing and
 * survives a wipe that reports success. That is what the spec caught.
 *
 * So a table is emitted before anything it is scoped THROUGH: before its parent,
 * and before `teams` if it is team-scoped. Tables with no such relation keep
 * their reset-list order relative to each other, which preserves the
 * children-before-parents foreign key ordering that list encodes.
 */
export const wipe_order = (plan) => {
  const tables = Object.keys(plan)
  const scoped_through = (table) => {
    if (plan[table].tier === 'parent') return plan[table].parent
    if (plan[table].tier === 'team') return 'teams'
    return null
  }

  const emitted = new Set()
  const order = []
  const visit = (table, stack) => {
    if (emitted.has(table)) return
    if (stack.includes(table)) {
      throw new Error(`scoping cycle: ${[...stack, table].join(' -> ')}`)
    }
    for (const other of tables) {
      if (other !== table && scoped_through(other) === table) {
        visit(other, [...stack, table])
      }
    }
    emitted.add(table)
    order.push(table)
  }

  for (const table of tables) visit(table, [])
  return order
}

/**
 * Clear every league-scoped row for one league.
 *
 * REFUSES LEAGUE 1 UNCONDITIONALLY. There is no flag to override it. League 1 is
 * the real league running the real auction, and the entire value of this script
 * is that it cannot be pointed at it by a mistyped argument at three in the
 * morning.
 */
export const wipe_league = async ({
  trx,
  lid,
  plan,
  on_progress = () => {}
}) => {
  if (!lid) throw new Error('wipe_league requires an explicit lid')
  refuse_league_one(lid, 'wipe')

  const resolved = plan || (await build_scope_plan({ trx }))
  const order = wipe_order(resolved)
  const cleared = {}
  on_progress({ phase: 'wipe', copied: 0, total: order.length })
  let wiped = 0
  for (const table of order) {
    cleared[table] = await scoped_query({
      trx,
      table,
      lid,
      plan: resolved
    }).del()
    wiped += 1
    on_progress({ phase: 'wipe', copied: wiped, total: order.length })
  }
  return cleared
}

/**
 * Copy the league's own row and its season configuration.
 *
 * The copy IS HOSTED. `is_hosted` false means an external read-only mirror,
 * which is what sync-external-league.mjs maintains; a league you cannot write to
 * cannot host an auction test.
 *
 * Four fields are cleared rather than copied, and each would reach OUT of the
 * copy if it were not:
 *
 *   the two Discord webhooks    a test auction announcing its nominations into
 *                               the real league's channel is the loudest
 *                               possible way to get this wrong
 *   the four external league ids  they claim an ESPN/Sleeper/MFL/Fleaflicker
 *                               league that the source already claims, so an
 *                               import against the copy would write the source's
 *                               upstream identity
 *   archived_at                 a clone is live by definition
 *
 * `seasons` is copied for EVERY year, not just the target one. A roster page and
 * the cap arithmetic behind it read the season row for the year they render, and
 * the rows are a handful.
 */
export const clone_league_metadata = async ({
  trx,
  from_lid,
  to_lid,
  name
}) => {
  if (to_lid !== undefined) refuse_league_one(to_lid, 'clone into')

  const source_league = await trx('leagues')
    .where({ league_id: from_lid })
    .first()
  if (!source_league) {
    throw new Error(`source league ${from_lid} not found`)
  }

  const { league_id, ...rest } = source_league
  const row = {
    ...rest,
    name: (name || `${source_league.name} clone`).slice(0, 50),
    is_hosted: true,
    discord_webhook_url: null,
    discord_announcements_webhook_url: null,
    espn_league_id: null,
    sleeper_league_id: null,
    mfl_league_id: null,
    fleaflicker_league_id: null,
    archived_at: null
  }
  if (to_lid !== undefined) {
    row.league_id = to_lid
  } else {
    await reconcile_sequence({ trx, table: 'leagues', column: 'league_id' })
  }

  const [inserted] = await trx('leagues').insert(row).returning('league_id')
  const new_lid = Number(inserted.league_id)
  refuse_league_one(new_lid, 'clone into')

  const seasons = await trx('seasons').where({ lid: from_lid })
  for (const season of seasons) {
    await trx('seasons').insert({ ...season, lid: new_lid })
  }

  return { lid: new_lid, seasons: seasons.length }
}

/**
 * Copy one league's board into another.
 *
 * TEAM IDENTITY IS ALLOCATED ONCE PER TEAM, NOT ONCE PER ROW. `teams` is keyed
 * on (team_id, season_year), so one team is several rows and the id is stable
 * across them. Inserting each row bare would draw a NEW id from the sequence for
 * every year and shatter one team into several, which then breaks every
 * historical transaction that names it.
 *
 * WHAT `transactions` CARRIES, which is the one judgment call in this file.
 * Every season's rows are copied EXCEPT the current season's AUCTION_BID and
 * AUCTION_PROCESSED. Both halves of that are load-bearing and they pull opposite
 * ways:
 *
 *   The history has to come, because `getRoster` INNER JOINs the newest
 *   transaction at or before the roster's (year, week) to find each player's
 *   salary. A player signed in an earlier season has that row in that earlier
 *   season, so copying only the current year drops most of the roster silently
 *   and reports a cap that is wrong in the direction of "plenty of room".
 *
 *   The current season's auction rows must NOT come, because
 *   `Auction._load_transactions` reads exactly those two types for exactly the
 *   current year to find the last nomination. Carrying them resumes the socket
 *   mid-auction on a league that has never started one, which is the opposite of
 *   the clean slate this exists to provide.
 */
export const clone_league_board = async ({
  trx,
  from_lid,
  to_lid,
  season_year,
  on_progress = () => {}
}) => {
  refuse_league_one(to_lid, 'clone into')

  const copied = {}

  // Every id below comes from a sequence, and each of these tables holds rows
  // this clone itself inserts under explicit ids. See reconcile_sequence.
  await reconcile_sequence({ trx, table: 'teams', column: 'team_id' })
  await reconcile_sequence({ trx, table: 'rosters', column: 'roster_id' })
  await reconcile_sequence({
    trx,
    table: 'transactions',
    column: 'transaction_id'
  })

  const teams = await trx('teams')
    .where({ lid: from_lid })
    .orderBy('team_id')
    .orderBy('season_year')
  const team_id_map = new Map()

  on_progress({ table: 'teams', copied: 0, total: teams.length })
  for (const team of teams) {
    const { team_id, ...rest } = team
    const known = team_id_map.get(team_id)
    if (known) {
      await trx('teams').insert({ ...rest, team_id: known, lid: to_lid })
      continue
    }
    const [inserted] = await trx('teams')
      .insert({ ...rest, lid: to_lid })
      .returning('team_id')
    team_id_map.set(team_id, Number(inserted.team_id))
  }
  copied.teams = teams.length

  const map_tid = (tid) => {
    const mapped = team_id_map.get(tid)
    if (!mapped) {
      throw new Error(`no cloned team for source tid ${tid}`)
    }
    return mapped
  }

  // ONLY THE COMMISSIONER IS ENROLLED. `users_teams` is league MEMBERSHIP: a
  // row here puts the league in that user's league list, lets them open it and
  // write to it, and makes them a notification recipient. Copying the source's
  // rows enrolled all fifteen of league 1's managers into the auction mirror --
  // a league none of them joined, running a test auction, where a click writes
  // real rows. Nobody but the operator should be able to reach a clone.
  //
  // Scoped to the target's own `commissioner_user_id` rather than to a passed
  // id, so it is the same answer on --create (copied from the source) and on
  // --sync (the target's preserved configuration), and so there is no argument
  // that can widen it back out.
  //
  // The other teams are left UNOWNED, not reassigned. A clone exists to walk
  // one manager's surfaces, and handing the operator ten teams would put them
  // in every matchup on both sides.
  const { commissioner_user_id } = await trx('leagues')
    .where({ league_id: to_lid })
    .first()
  const users_teams = await trx('users_teams')
    .whereIn('tid', Array.from(team_id_map.keys()))
    .where({ user_id: commissioner_user_id })
  copied.users_teams = await insert_in_batches({
    trx,
    table: 'users_teams',
    rows: users_teams.map((row) => ({ ...row, tid: map_tid(row.tid) })),
    on_progress
  })

  const rosters = await trx('rosters').where({ lid: from_lid, season_year })
  const roster_id_map = new Map()
  on_progress({ table: 'rosters', copied: 0, total: rosters.length })
  for (const roster of rosters) {
    const { roster_id, ...rest } = roster
    const [inserted] = await trx('rosters')
      .insert({ ...rest, lid: to_lid, tid: map_tid(roster.tid) })
      .returning('roster_id')
    roster_id_map.set(roster_id, Number(inserted.roster_id))
  }
  copied.rosters = rosters.length

  const roster_players = await trx('rosters_players').where({
    lid: from_lid,
    season_year
  })
  copied.rosters_players = await insert_in_batches({
    trx,
    table: 'rosters_players',
    rows: roster_players.map((row) => ({
      ...row,
      lid: to_lid,
      tid: map_tid(row.tid),
      roster_id: roster_id_map.get(row.roster_id)
    })),
    on_progress
  })

  const transactions = await trx('transactions')
    .where({ lid: from_lid })
    .whereNot(function () {
      this.where('season_year', season_year).whereIn('type', [
        transaction_types.AUCTION_BID,
        transaction_types.AUCTION_PROCESSED
      ])
    })
  copied.transactions = await insert_in_batches({
    trx,
    table: 'transactions',
    rows: transactions.map((row) => {
      const { transaction_id, ...rest } = row
      return { ...rest, lid: to_lid, tid: map_tid(row.tid) }
    }),
    on_progress
  })

  // THE RFA CYCLE COMES BECAUSE THE TRANSACTION LOG ABOVE REFERENCES IT.
  // A RESTRICTED_FREE_AGENCY_TAG transaction is an ASSERTION that a successful
  // bid exists to justify it, and `calculate-team-daily-ktc-value` enforces
  // exactly that -- it reads the tag, looks up the signing by (pid, date), and
  // throws when there is none. It has to look it up rather than trust the tag,
  // because the tag names only the WINNING team and the replay needs the losing
  // one, which lives on the nomination's `original_team_id`.
  //
  // Copying the tags without the bids was this file's own bug. It read as a
  // clean separation -- an auction does not care about a prior RFA cycle -- but
  // the tags were coming anyway as ordinary salary history, so the clone was
  // publishing 115 assertions whose evidence it had deliberately withheld. The
  // valuation job threw on the first one, and because its driver had no per-
  // league isolation, league 1 went unpriced from 2026-08-31 to 2026-09-04.
  //
  // Dropping the tags instead would have been the other way to close it, and is
  // worse: a tag carries `player_salary`, so `getRoster`'s salary join reads it
  // to price the player, and the tags are load-bearing in the roster-asset
  // lineage walk, super-priority resolution and acquisition lookup besides.
  //
  // Nominations and bids reference EACH OTHER -- `bids.nomination_id` one way,
  // `nominations.winning_bid_id` the other -- so nominations land first with
  // the back-reference held null, and it is filled once the bid ids exist.
  await reconcile_sequence({
    trx,
    table: 'restricted_free_agency_nominations',
    column: 'nomination_id'
  })
  await reconcile_sequence({
    trx,
    table: 'restricted_free_agency_bids',
    column: 'bid_id'
  })

  const nominations = await trx('restricted_free_agency_nominations').where({
    league_id: from_lid
  })
  const nomination_id_map = new Map()
  on_progress({
    table: 'restricted_free_agency_nominations',
    copied: 0,
    total: nominations.length
  })
  for (const nomination of nominations) {
    const { nomination_id, winning_bid_id, ...rest } = nomination
    const [inserted] = await trx('restricted_free_agency_nominations')
      .insert({
        ...rest,
        league_id: to_lid,
        original_team_id: map_tid(nomination.original_team_id),
        winning_bid_id: null
      })
      .returning('nomination_id')
    nomination_id_map.set(nomination_id, Number(inserted.nomination_id))
  }
  copied.restricted_free_agency_nominations = nominations.length

  // Every bid comes, not just the successful ones. The successful bid is what
  // the valuation job needs, but a cycle in which every bid won is not the
  // cycle the source ran, and the RFA surfaces read the losing bids too.
  const bids = await trx('restricted_free_agency_bids').where({
    lid: from_lid
  })
  const bid_id_map = new Map()
  on_progress({
    table: 'restricted_free_agency_bids',
    copied: 0,
    total: bids.length
  })
  for (const bid of bids) {
    const { bid_id, ...rest } = bid
    const [inserted] = await trx('restricted_free_agency_bids')
      .insert({
        ...rest,
        lid: to_lid,
        tid: map_tid(bid.tid),
        nomination_id:
          bid.nomination_id === null
            ? null
            : nomination_id_map.get(bid.nomination_id)
      })
      .returning('bid_id')
    bid_id_map.set(bid_id, Number(inserted.bid_id))
  }
  copied.restricted_free_agency_bids = bids.length

  for (const nomination of nominations) {
    if (nomination.winning_bid_id === null) continue
    await trx('restricted_free_agency_nominations')
      .where({ nomination_id: nomination_id_map.get(nomination.nomination_id) })
      .update({
        winning_bid_id: bid_id_map.get(nomination.winning_bid_id)
      })
  }

  // Scoped through the bid rather than by a league column, which this table
  // does not carry -- the same tier-2 derivation the reset gate uses.
  const releases = await trx('restricted_free_agency_releases').whereIn(
    'restricted_free_agency_bid_id',
    Array.from(bid_id_map.keys())
  )
  copied.restricted_free_agency_releases = await insert_in_batches({
    trx,
    table: 'restricted_free_agency_releases',
    rows: releases.map((row) => ({
      ...row,
      restricted_free_agency_bid_id: bid_id_map.get(
        row.restricted_free_agency_bid_id
      )
    })),
    on_progress
  })

  return { copied, team_id_map }
}

/**
 * The target's own `leagues` and `seasons` rows, taken before a wipe clears
 * them, so a re-sync can put THEM back rather than the source's.
 *
 * WHY A SYNC MUST NOT RE-COPY THE CONFIGURATION. A mirror is not a byte copy of
 * its source; it differs on purpose, and the differences are exactly what make
 * it walkable. The auction mirror runs with election mode ON and its free agency
 * period ALREADY OPEN, while league 1 has election mode off and a period that
 * opens days from now. Re-copying league 1's season row would turn election mode
 * off and push the period into the future, so the next election would be refused
 * -- and nothing about the sync's output would say why.
 *
 * The BOARD is what a sync re-copies. The configuration is the target's.
 *
 * Returns null when the target has no `leagues` row, which is a --sync into a
 * league id that does not exist yet. That falls back to copying the source's
 * configuration, because there is nothing else to preserve.
 */
export const capture_league_configuration = async ({ trx, lid }) => {
  const league_row = await trx('leagues').where({ league_id: lid }).first()
  if (!league_row) return null
  const seasons = await trx('seasons').where({ lid })
  return { league: league_row, seasons }
}

export const restore_league_configuration = async ({ trx, configuration }) => {
  await trx('leagues').insert(configuration.league)
  for (const season of configuration.seasons) {
    await trx('seasons').insert(season)
  }
  return {
    lid: Number(configuration.league.league_id),
    seasons: configuration.seasons.length
  }
}

/**
 * Season columns where the preserved target differs from the source.
 *
 * Reported rather than reconciled. A sync that silently keeps a stale setting is
 * the same failure as one that silently overwrites a deliberate one -- the
 * operator has to be able to see which of the two happened.
 */
export const configuration_drift = ({ configuration, source_seasons }) => {
  const source_by_year = new Map(
    source_seasons.map((season) => [season.season_year, season])
  )
  const drift = []
  for (const season of configuration.seasons) {
    const source = source_by_year.get(season.season_year)
    if (!source) continue
    for (const column of Object.keys(season)) {
      if (column === 'lid') continue
      if (String(season[column]) !== String(source[column])) {
        drift.push(`${season.season_year}.${column}`)
      }
    }
  }
  return drift
}

/**
 * Stand up a new copy, or reset an existing one and re-copy it.
 *
 * One function for both verbs, because they differ only in whether the target
 * already exists. Everything runs inside ONE transaction the caller owns, and
 * the source count comparison happens INSIDE it -- a source write detected after
 * a commit is a report, while one detected before it is a rollback.
 */
export const clone_league = async ({
  trx,
  from_lid,
  to_lid,
  season_year,
  name,
  on_progress = () => {}
}) => {
  if (Number(from_lid) === Number(to_lid)) {
    throw new Error('refusing to clone a league into itself')
  }
  if (to_lid !== undefined) refuse_league_one(to_lid, 'clone into')

  on_progress({ phase: 'plan' })
  const plan = await build_scope_plan({ trx })
  on_progress({ phase: 'count-source' })
  const source_before = await count_league_rows({ trx, lid: from_lid, plan })

  let configuration = null
  if (to_lid !== undefined) {
    configuration = await capture_league_configuration({ trx, lid: to_lid })
    await wipe_league({ trx, lid: to_lid, plan, on_progress })
  }

  const { lid } = configuration
    ? await restore_league_configuration({ trx, configuration })
    : await clone_league_metadata({ trx, from_lid, to_lid, name })

  const { copied } = await clone_league_board({
    trx,
    from_lid,
    to_lid: lid,
    season_year,
    on_progress
  })

  on_progress({ phase: 'verify-source' })
  const source_after = await count_league_rows({ trx, lid: from_lid, plan })
  const drift = diff_counts(source_before, source_after)
  if (drift.length) {
    throw new Error(
      `source league ${from_lid} was written during the clone: ${drift.join(', ')}`
    )
  }

  return {
    lid,
    copied,
    configuration_preserved: Boolean(configuration),
    configuration_drift: configuration
      ? configuration_drift({
          configuration,
          source_seasons: await trx('seasons').where({ lid: from_lid })
        })
      : []
  }
}

export default {
  LEAGUE_SCOPED_TABLES,
  CLONED_BOARD_TABLES,
  NOT_CLONED_REASONS,
  parse_league_scoped_tables,
  parent_table_for,
  parent_key_for,
  resolve_scope,
  build_scope_plan,
  count_league_rows,
  diff_counts,
  wipe_order,
  wipe_league,
  clone_league_metadata,
  clone_league_board,
  clone_league
}
