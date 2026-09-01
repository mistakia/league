import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

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

/**
 * What a clone actually copies, and why it is NOT the full list above.
 *
 * The wipe is complete by construction; the COPY is deliberately small and
 * reviewed. Eight of the league-scoped tables carry no league key at all --
 * `waiver_releases`, `poach_releases`, the four admission-vote children and the
 * trade children are grandchildren keyed on a parent row's surrogate id. Copying
 * those means remapping every id a sequence hands out, and a clone that gets
 * that subtly wrong is worse than one that never claims to have done it.
 *
 * None of them bear on an auction. What an auction walk needs is the BOARD:
 * who the teams are, who manages them, what they roster, and what those players
 * cost.
 *
 * `transactions` is in the set for a reason that is easy to miss: `getRoster`
 * INNER JOINs it to source each rostered player's salary, because
 * `rosters_players` carries no value column. Omit it and every rostered player
 * silently disappears from the cloned roster and the cap arithmetic is wrong.
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
  restricted_free_agency_bids:
    'a prior RFA cycle, unrelated to the free agency auction',
  draft: 'the rookie draft precedes free agency and does not affect the board'
}

const LEAGUE_KEY_COLUMNS = {
  leagues: 'league_id',
  restricted_free_agency_nominations: 'league_id',
  bid_changelog: 'league_id',
  league_pauses: 'league_id',
  admission_votes: 'league_id'
}

const league_key_for = (table) => LEAGUE_KEY_COLUMNS[table] || 'lid'

/**
 * Clear every league-scoped row for one league.
 *
 * REFUSES LEAGUE 1 UNCONDITIONALLY. There is no flag to override it. League 1 is
 * the real league running the real auction, and the entire value of this script
 * is that it cannot be pointed at it by a mistyped argument at three in the
 * morning.
 */
export const wipe_league = async ({ trx, lid }) => {
  if (!lid) throw new Error('wipe_league requires an explicit lid')
  if (Number(lid) === 1) {
    throw new Error(
      'refusing to wipe league 1: that is the live league running the real auction'
    )
  }

  const cleared = {}
  // In reset-list order, which is children before parents -- the ordering is
  // load-bearing where a foreign key actually exists.
  for (const table of LEAGUE_SCOPED_TABLES) {
    const key = league_key_for(table)
    const has_key = await trx(table).columnInfo()
    if (!has_key[key]) continue
    cleared[table] = await trx(table).where(key, lid).del()
  }
  return cleared
}

/**
 * Copy one league's board into another.
 *
 * Leaves `transactions` of type AUCTION_BID and AUCTION_PROCESSED behind
 * deliberately: `_load_transactions` reads them to find the last nomination, so
 * copying an auction history would make the socket resume mid-auction on a
 * league that has not started one.
 */
export const clone_league_board = async ({
  trx,
  from_lid,
  to_lid,
  season_year
}) => {
  if (Number(to_lid) === 1) {
    throw new Error('refusing to clone into league 1')
  }

  const copied = {}

  const teams = await trx('teams').where({ lid: from_lid, season_year })
  const team_id_map = new Map()

  for (const team of teams) {
    const { team_id, ...rest } = team
    const [inserted] = await trx('teams')
      .insert({ ...rest, lid: to_lid })
      .returning('team_id')
    team_id_map.set(team_id, inserted.team_id)
  }
  copied.teams = teams.length

  const users_teams = await trx('users_teams')
    .whereIn('tid', Array.from(team_id_map.keys()))
    .where({ season_year })
  for (const row of users_teams) {
    await trx('users_teams').insert({
      ...row,
      tid: team_id_map.get(row.tid)
    })
  }
  copied.users_teams = users_teams.length

  const rosters = await trx('rosters').where({ lid: from_lid, season_year })
  const roster_id_map = new Map()
  for (const roster of rosters) {
    const { roster_id, ...rest } = roster
    const [inserted] = await trx('rosters')
      .insert({
        ...rest,
        lid: to_lid,
        tid: team_id_map.get(roster.tid)
      })
      .returning('roster_id')
    roster_id_map.set(roster_id, inserted.roster_id)
  }
  copied.rosters = rosters.length

  const roster_players = await trx('rosters_players').where({
    lid: from_lid,
    season_year
  })
  for (const row of roster_players) {
    await trx('rosters_players').insert({
      ...row,
      lid: to_lid,
      tid: team_id_map.get(row.tid),
      roster_id: roster_id_map.get(row.roster_id)
    })
  }
  copied.rosters_players = roster_players.length

  // Salary-bearing transactions only, and never the auction's own rows.
  const salary_transactions = await trx('transactions')
    .where({ lid: from_lid, season_year })
    .whereNotIn('type', [6, 7])
  for (const row of salary_transactions) {
    const { transaction_id, ...rest } = row
    await trx('transactions').insert({
      ...rest,
      lid: to_lid,
      tid: team_id_map.get(row.tid)
    })
  }
  copied.transactions = salary_transactions.length

  return { copied, team_id_map }
}

export default {
  LEAGUE_SCOPED_TABLES,
  CLONED_BOARD_TABLES,
  NOT_CLONED_REASONS,
  parse_league_scoped_tables,
  wipe_league,
  clone_league_board
}
