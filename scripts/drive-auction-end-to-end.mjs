#!/usr/bin/env node
/**
 * Drive the free agency auction end to end against a real hosted league.
 *
 * WHY THIS EXISTS. Every defect this subsystem has produced came from EXECUTING
 * the behavior -- two planned components that were never built, a manager's own
 * elections never loading, a board showing 2.7x the real budget, an auction that
 * stalled after every sale, a socket that armed no clock inside a block, a
 * fallback tier querying columns the schema does not have. None came from
 * reading the source. The suite covers the pieces in isolation against a
 * fixture; nothing drove the whole thing against real players, real rosters and
 * the real routes until a human did it by hand, once, unrepeatably.
 *
 * This is that walk, checked in. It is NOT a mocha spec: it takes a real league
 * id, opens a real socket, writes real rows, and prints a report a human reads.
 *
 * WHAT IT REFUSES. League 1 is the real auction. This refuses it unconditionally
 * and additionally requires the target to be hosted, in election mode, and to
 * carry NO Discord webhook of either kind -- so a misaimed run cannot message a
 * league. Every teardown delete is gated on a count query proving the rows it is
 * about to remove exist on no other league, never on the previous step's exit
 * status.
 *
 * WHAT IT LEAVES BEHIND. Nothing. Elections, blocks, opt-ins, auction
 * transactions and signed roster rows are removed, and every charged
 * `teams.salary_cap` is restored. A finalized block left on the mirror would put
 * that league into live mode on a wall clock. The teardown runs at the START of
 * a run as well as at the end, and `--teardown-only` recovers a league from a
 * run that was killed before it could clean up after itself.
 *
 * usage:
 *   node scripts/drive-auction-end-to-end.mjs --lid 119
 *   node scripts/drive-auction-end-to-end.mjs --lid 119 --only elections,blocks
 *   node scripts/drive-auction-end-to-end.mjs --lid 119 --keep     # skip teardown
 *   node scripts/drive-auction-end-to-end.mjs --lid 119 --teardown-only
 *
 * It needs no stack running and no ports guessed: it boots the working-tree API
 * in this process on an ephemeral port with an ephemeral JWT secret, and reaches
 * the production database over an SSH tunnel it opens if one is not already
 * there. The three traps that have each cost a session real time -- the dev
 * server binding 8091 rather than 8080, the API not hot-reloading, and
 * `yarn dev:smoke` opening the database read-only -- are all absent by
 * construction.
 *
 * To reset the board between attempts, re-sync the mirror from league 1:
 *   NODE_ENV=production node scripts/clone-league.mjs --sync --from 1 --to 119 --execute
 */

import { randomBytes } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import jwt from 'jsonwebtoken'
import dayjs from 'dayjs'
import WebSocket from 'ws'

// NOTHING that reads `#config` or `#db` may be a STATIC import here. A static
// import hoists above every statement in this file, and both of those modules
// read their target at module load -- `#config` from NODE_ENV, `#db` from
// LEAGUE_DB_*. Imported statically they would bind before this file got a chance
// to point either anywhere. Everything below the environment block, `#api` and
// `#libs-server` included, is a dynamic import for that reason, and it is also
// why this file does not use the `is_main` entry-point pattern: the barrel it
// lives in pulls `#db`.
const repo_root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

// PINNED, not inherited. The database target is stated explicitly below, so the
// only things NODE_ENV still selects are the ones that must not vary: production
// would boot an HTTPS server against certificates this has no use for, and would
// arm `send-notifications`, which refuses outside production and is the reason a
// misfire here cannot reach a Discord channel even if a webhook appeared.
process.env.NODE_ENV = 'development'

const { default: config, load_sops_json } = await import('#config')

// ============================================================================
// ARGUMENTS
// ============================================================================

const parse_args = (argv) => {
  const args = { db_port: 15433, ssh_host: 'league', keep: false, only: null }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--lid') args.lid = Number(argv[++i])
    else if (arg === '--db-port') args.db_port = Number(argv[++i])
    else if (arg === '--ssh-host') args.ssh_host = argv[++i]
    else if (arg === '--keep') args.keep = true
    else if (arg === '--teardown-only') args.teardown_only = true
    else if (arg === '--only') args.only = argv[++i].split(',')
    else throw new Error(`unknown argument: ${arg}`)
  }
  if (!args.lid) throw new Error('--lid <league id> is required')
  // Stated here as well as at the identity assertion below, because this is the
  // one refusal that must not depend on a database read succeeding.
  if (args.lid === 1) {
    throw new Error(
      'league 1 is the real auction and is refused unconditionally'
    )
  }
  return args
}

const args = parse_args(process.argv.slice(2))

// ============================================================================
// ENVIRONMENT: production database, ephemeral API
// ============================================================================

const is_port_open = (port) =>
  new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port })
    socket.setTimeout(1500)
    socket.on('connect', () => {
      socket.destroy()
      resolve(true)
    })
    socket.on('error', () => resolve(false))
    socket.on('timeout', () => {
      socket.destroy()
      resolve(false)
    })
  })

// The production connection is derived at runtime through the same fail-closed
// sops shell-out the config loader uses, and passed to `#db` in-process. No
// credential is ever an argument, an environment literal in a printed command,
// or a file on disk.
const production = load_sops_json(
  path.join(repo_root, 'config', 'config-production.json')
)

if (!(await is_port_open(args.db_port))) {
  process.stdout.write(
    `opening ssh tunnel 127.0.0.1:${args.db_port} -> ${args.ssh_host}:5432\n`
  )
  const result = spawnSync('ssh', [
    '-f',
    '-N',
    '-L',
    `${args.db_port}:127.0.0.1:5432`,
    args.ssh_host
  ])
  if (result.status !== 0) {
    throw new Error(`could not open an ssh tunnel to ${args.ssh_host}`)
  }
  // Deliberately left open rather than torn down: an idle tunnel is harmless,
  // concurrent sessions share this port, and killing by process pattern would
  // take out a sibling's tunnel opened with the same spec.
}

process.env.LEAGUE_DB_HOST = '127.0.0.1'
process.env.LEAGUE_DB_PORT = String(args.db_port)
process.env.LEAGUE_DB_DATABASE = production.postgres.connection.database
process.env.LEAGUE_DB_USER = production.postgres.connection.user
process.env.LEAGUE_DB_PASSWORD = String(production.postgres.connection.password)

// The API this boots issues and verifies its own tokens, so the secret only has
// to be internally consistent -- never production's. A fresh random one per run
// means a token this script mints is worthless the moment the process exits.
config.jwt = { secret: randomBytes(32).toString('hex'), algorithms: ['HS256'] }

// Long enough that nothing sells or auto-nominates underneath the live-block
// scenario while it is being driven. The clocks are real `setTimeout`s here --
// the injected-timer seam exists for the suite, not for this.
config.bidTimer = 10 * 60 * 1000
config.nominationTimer = 10 * 60 * 1000

const { default: db } = await import('#db')
const { default: server } = await import('#api')
const { current_season, transaction_types, auction_election_outcomes } =
  await import('#constants')
const { get_auction_nominating_team_id } =
  await import('#libs-server/auction-completion.mjs')
const { get_auction_mode, resolve_auction_mode_at, AUCTION_MODES } =
  await import('#libs-server/auction-modes.mjs')
const { floor_to_block } = await import('#libs-server/auction-blocks.mjs')
const { Roster } = await import('#libs-shared')
const { default: getRoster } = await import('#libs-server/get-roster.mjs')
const { default: getLeague } = await import('#libs-server/get-league.mjs')
const { format_nomination_complete_message, format_block_convened_message } =
  await import('#libs-server/format-auction-discord-message.mjs')

const lid = args.lid
const season_year = current_season.year

// ============================================================================
// REPORTING
// ============================================================================

const scenarios = []
let active = null

const record = (status, label, detail) => {
  active.checks.push({ status, label, detail })
  const suffix = detail ? ` -- ${detail}` : ''
  process.stdout.write(`  ${status.padEnd(5)} ${label}${suffix}\n`)
}

/** A check that records and keeps going. */
const ok = (label, condition, detail) => {
  record(condition ? 'PASS' : 'FAIL', label, condition ? '' : detail)
  return Boolean(condition)
}

/** A check the rest of the scenario depends on: records, then aborts. */
const must = (label, condition, detail) => {
  if (!ok(label, condition, detail)) {
    throw new Error(`${label}: ${detail || 'precondition failed'}`)
  }
}

/**
 * Something this cannot drive end to end, stated rather than asserted weakly.
 *
 * A partial is not a pass and is not a failure. It is the honest third answer,
 * and writing it down is what stops the next reader believing a surface is
 * covered because a nearby line was green.
 */
const partial = (label, reason) => {
  active.checks.push({ status: 'N/A', label, detail: reason })
  process.stdout.write(`  N/A   ${label} -- ${reason}\n`)
}

const scenario = async (name, fn) => {
  if (args.only && !args.only.includes(name)) return
  active = { name, checks: [], error: null, seconds: 0 }
  scenarios.push(active)
  process.stdout.write(`\n${name}\n`)
  const started = Date.now()
  try {
    await fn()
  } catch (error) {
    active.error = error
    process.stdout.write(`  ABORT ${error.message}\n`)
  }
  active.seconds = Math.round((Date.now() - started) / 1000)
}

// ============================================================================
// DRIVERS
// ============================================================================

let base_url = null

const commissioner_token = () =>
  jwt.sign({ userId: league_row.commissioner_user_id }, config.jwt.secret)

const api = async (method, url_path, body) => {
  const response = await fetch(`${base_url}${url_path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${commissioner_token()}`
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  })
  const text = await response.text()
  let parsed = null
  try {
    parsed = JSON.parse(text)
  } catch {
    parsed = { raw: text.slice(0, 200) }
  }
  return { status: response.status, body: parsed }
}

const elections_path = `/api/leagues/${lid}/auction-elections`
const blocks_path = `/api/leagues/${lid}/auction-blocks`

const elect = (teamId, pid, maximum_bid = null) =>
  api('POST', elections_path, { leagueId: lid, teamId, pid, maximum_bid })

const withdraw = (teamId, pid) =>
  api('DELETE', elections_path, { leagueId: lid, teamId, pid })

const read_elections = (teamId) =>
  api('GET', `${elections_path}?teamId=${teamId}`)

const settlement_status = () => api('GET', `${elections_path}/status`)

const set_opt_in = (teamId, block_at, is_opted_in = true) =>
  api('POST', blocks_path, { teamId, block_at, is_opted_in })

const read_schedule = () => api('GET', blocks_path)

/**
 * A connected client, which is the only witness that can tell a working
 * broadcast from a page reload.
 *
 * Every re-read satisfies "the server got it right" and none of them satisfy
 * "an already-loaded page updated" -- and the second is the claim that has
 * shipped broken here, twice.
 */
const open_client = ({ tid }) =>
  new Promise((resolve, reject) => {
    const token = commissioner_token()
    const socket = new WebSocket(
      `${base_url.replace('http', 'ws')}/?league_id=${lid}&token=${token}`
    )
    const received = []
    socket.on('message', (data) => received.push(JSON.parse(data)))
    socket.on('error', reject)
    socket.on('open', () => {
      socket.send(
        JSON.stringify({
          type: 'AUCTION_JOIN',
          payload: {
            lid,
            tid,
            clientId: `drive-${randomBytes(4).toString('hex')}`
          }
        })
      )
      resolve({
        socket,
        received,
        mark: () => received.length,
        send: (message) => socket.send(JSON.stringify(message)),
        /** The first message of `type` after `from`, or null on timeout. */
        await_message: async (
          type,
          { from = 0, where, timeout_ms = 30_000 } = {}
        ) => {
          const deadline = Date.now() + timeout_ms
          while (Date.now() < deadline) {
            const found = received
              .slice(from)
              .find((entry) => entry.type === type && (!where || where(entry)))
            if (found) return found
            await sleep(50)
          }
          return null
        }
      })
    })
  })

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Wait for the auction's opening payload, and say how long it took.
 *
 * GENEROUSLY, and the timing is the point. `Auction.setup` walks every roster in
 * the league to compute capacities, and `_refresh_mode` walks them twice more --
 * once for the block-eligible set and once for the final block's spots
 * remaining. Against a real ten-team board that is thirty roster loads before
 * the first byte reaches a client, which is the "the auction page needs 15 to 25
 * seconds" that two earlier readings mistook for a broken page. A 20-second
 * timeout here sat right on the boundary and made the socket look dead.
 */
const await_init = async (client) => {
  const started = Date.now()
  const init = await client.await_message('AUCTION_INIT', {
    timeout_ms: 120_000
  })
  const seconds = ((Date.now() - started) / 1000).toFixed(1)
  must(
    'the socket sends AUCTION_INIT',
    Boolean(init),
    'no AUCTION_INIT within 120s'
  )
  record('PASS', 'AUCTION_INIT arrives', `${seconds}s after AUCTION_JOIN`)
  return init
}

// ============================================================================
// TARGET IDENTITY, SNAPSHOT AND TEARDOWN
// ============================================================================

let league_row = null
let team_ids = []
let own_team = null
const signed_pids = new Set()

/** A team's remaining budget, through the same rule the auction prices against. */
const available_cap = async (tid) => {
  const league = await getLeague({ lid })
  return new Roster({ roster: await getRoster({ tid }), league }).availableCap
}

const assert_target_is_safe = async () => {
  league_row = await db('leagues').where({ league_id: lid }).first()
  if (!league_row) throw new Error(`no league ${lid}`)

  const season = await db('seasons').where({ lid, season_year }).first()
  if (!season) throw new Error(`no ${season_year} season row for league ${lid}`)

  const refusals = []
  if (lid === 1) refusals.push('league 1 is the real auction')
  if (!league_row.is_hosted) refusals.push('league is not hosted')
  if (!season.is_auction_election_mode_enabled) {
    refusals.push('league is not in election mode')
  }
  // A webhook is the one thing a misaimed run cannot take back, so it gates
  // ahead of everything else this writes.
  if (league_row.discord_webhook_url)
    refusals.push('league has a Discord webhook')
  if (league_row.discord_announcements_webhook_url) {
    refusals.push('league has a Discord announcements webhook')
  }
  if (!season.free_agency_period_start) {
    refusals.push('league has no free agency period')
  }
  if (dayjs().isAfter(dayjs(season.free_agency_period_end))) {
    refusals.push('the free agency period has closed')
  }

  if (refusals.length) {
    throw new Error(`refusing league ${lid}: ${refusals.join('; ')}`)
  }

  const teams = await db('teams')
    .where({ lid, season_year })
    .orderBy('draft_order')
  team_ids = teams.map((team) => team.team_id)

  const owned = await db('users_teams')
    .where({ user_id: league_row.commissioner_user_id, season_year })
    .whereIn('tid', team_ids)
    .first()
  if (!owned) {
    throw new Error(
      `the commissioner of league ${lid} holds no team in it, so no read can be driven through the ownership branch`
    )
  }
  own_team = owned.tid

  process.stdout.write(
    `target: league ${lid} "${league_row.name}", ${team_ids.length} teams, ` +
      `period ends ${dayjs(season.free_agency_period_end).toISOString()}\n`
  )
  return season
}

/**
 * The starting board, checked rather than assumed.
 *
 * Run AFTER the opening teardown, so it is checking the state this run will
 * actually drive from. Two things it catches: a leftover election changes which
 * teams are outstanding and would make the settlement scenario assert against
 * the wrong set, and a `teams.salary_cap` that no longer matches the league cap
 * means the teardown's restore rule is not true of this league.
 */
const assert_board_is_clean = async () => {
  const league = await getLeague({ lid })
  const teams = await db('teams').where({ lid, season_year })
  const drifted = teams.filter((team) => team.salary_cap !== league.salary_cap)
  if (drifted.length) {
    throw new Error(
      `team salary caps on league ${lid} do not match the league cap of ` +
        `${league.salary_cap}: ${drifted
          .map((team) => `${team.team_id}=${team.salary_cap}`)
          .join(', ')}. Re-sync the mirror with clone-league.mjs --sync.`
    )
  }

  const [{ count }] = await db('transactions')
    .where({ lid, season_year })
    .whereIn('type', [
      transaction_types.AUCTION_BID,
      transaction_types.AUCTION_PROCESSED
    ])
    .count('* as count')
  if (Number(count) !== 0) {
    throw new Error(
      `league ${lid} still carries ${count} auction transaction(s)`
    )
  }
}

/**
 * Remove every row this script can have written, and restore the caps.
 *
 * GATED ON THE CONTENT OF WHAT IS ABOUT TO BE DELETED, never on whether the
 * previous step succeeded. Each delete first counts the rows its predicate
 * matches OUTSIDE this league and refuses if that count is not zero -- so a
 * predicate that lost its `lid` term aborts rather than reaching league 1.
 */
const teardown = async () => {
  process.stdout.write('\nteardown\n')

  const assert_scoped = async (table, builder) => {
    const [row] = await builder(db(table))
      .whereNot('lid', lid)
      .count('* as count')
    const outside = Number(row.count)
    if (outside !== 0) {
      throw new Error(
        `refusing to delete from ${table}: predicate matches ${outside} row(s) outside league ${lid}`
      )
    }
  }

  const scoped_delete = async (table, builder, label) => {
    await assert_scoped(table, builder)
    const deleted = await builder(db(table)).where('lid', lid).del()
    process.stdout.write(`  removed ${deleted} ${label}\n`)
  }

  // THE CAP IS RESTORED FROM THE TRANSACTION LOG, not from a snapshot taken at
  // the top of this process. A snapshot cannot undo a settlement written by an
  // earlier run that died before its own teardown -- it would faithfully restore
  // the already-damaged value, which is what happened the first time this ran.
  //
  // `persist_auction_settlement` does not DECREMENT `teams.salary_cap`; it
  // OVERWRITES it with the team's remaining budget (`cap_before - price`), so
  // adding the price back does not undo it either. The field is a per-team
  // override of the league cap and every team on a freshly synced mirror carries
  // the league value, which `assert_target_is_safe` checks after this runs --
  // so restoring the league value is exact, and the assertion is what keeps it
  // exact rather than assumed.
  const settled = await db('transactions')
    .where({ lid, season_year, type: transaction_types.AUCTION_PROCESSED })
    .select('tid', 'player_salary', 'pid')
  const league = await getLeague({ lid })
  for (const row of settled) {
    await db('teams')
      .where({ team_id: row.tid, season_year, lid })
      .update({ salary_cap: league.salary_cap })
    // A settlement this process did not perform still left a roster row behind.
    signed_pids.add(row.pid)
  }
  process.stdout.write(`  reversed ${settled.length} settlement charge(s)\n`)

  await scoped_delete(
    'auction_elections',
    (query) => query.where({ season_year }),
    'election(s)'
  )
  await scoped_delete(
    'auction_block_opt_ins',
    (query) => query.where({ season_year }),
    'block opt-in(s)'
  )
  await scoped_delete(
    'auction_blocks',
    (query) => query.where({ season_year }),
    'finalized block(s)'
  )
  await scoped_delete(
    'transactions',
    (query) =>
      query
        .where({ season_year })
        .whereIn('type', [
          transaction_types.AUCTION_BID,
          transaction_types.AUCTION_PROCESSED
        ]),
    'auction transaction(s)'
  )

  // Only the players this run signed. A cloned board legitimately carries
  // rosters_players rows, and a blanket delete here would strip the mirror.
  if (signed_pids.size) {
    await scoped_delete(
      'rosters_players',
      (query) => query.where({ season_year }).whereIn('pid', [...signed_pids]),
      'signed roster row(s)'
    )
  }

  signed_pids.clear()
}

/** Free agents in this league, deterministic and never rostered. */
const pick_free_agents = async ({ count, primary_position = 'RB' }) => {
  const rostered = await db('rosters_players')
    .where({ lid, season_year })
    .pluck('pid')
  const rows = await db('player')
    .whereNot('current_nfl_team', 'INA')
    .where('primary_position', primary_position)
    .whereNotIn('pid', rostered.length ? rostered : [''])
    .orderBy('pid')
    .limit(count)
  if (rows.length < count) {
    throw new Error(
      `only ${rows.length} unrostered ${primary_position}s available`
    )
  }
  return rows.map((row) => row.pid)
}

// ============================================================================
// SCENARIOS
// ============================================================================

/**
 * A maximum, a revision, a decline and the withdrawal of one, read back through
 * the route that serves the standing-elections panel.
 */
const drive_elections = async (pids) => {
  const [pid] = pids
  // READS use the commissioner's OWN team. `verifyUserTeam` additionally
  // authorizes a commissioner against every team in their league, and a read of
  // the standing-elections route is a read of sealed maximums -- so exercising
  // the scoping through that branch would assert nothing about the branch a
  // manager actually takes. Writes below still use it, because a write leaks
  // nothing.
  const team = own_team
  const other_team = team_ids.find((tid) => tid !== own_team)

  const set_response = await elect(team, pid, 12)
  must(
    'a maximum is accepted',
    set_response.status === 200,
    JSON.stringify(set_response.body)
  )

  let read = await read_elections(team)
  must(
    'own elections read back',
    read.status === 200,
    JSON.stringify(read.body)
  )
  const first = read.body.find((row) => row.pid === pid)
  ok(
    'the maximum reads back at 12',
    first && first.maximum_bid === 12,
    JSON.stringify(first)
  )
  ok(
    'effective_maximum is capped at availableCap and agrees with is_capped',
    first &&
      first.effective_maximum <= 12 &&
      first.is_capped === first.effective_maximum < 12,
    JSON.stringify(first)
  )
  const first_amount_set_at = first && first.amount_set_at

  await sleep(1100)
  const revise = await elect(team, pid, 20)
  ok(
    'a revision is accepted',
    revise.status === 200,
    JSON.stringify(revise.body)
  )
  read = await read_elections(team)
  const revised = read.body.find((row) => row.pid === pid)
  ok(
    'the revision reads back at 20',
    revised && revised.maximum_bid === 20,
    JSON.stringify(revised)
  )
  ok(
    'amount_set_at moves with the amount',
    revised && new Date(revised.amount_set_at) > new Date(first_amount_set_at),
    `${first_amount_set_at} -> ${revised && revised.amount_set_at}`
  )

  // A second team's ceiling on the SAME player, so the scoping assertion below
  // has a real amount it could have leaked rather than an empty set.
  const rival = await elect(other_team, pid, 99)
  must(
    'a second team can elect on the same player',
    rival.status === 200,
    JSON.stringify(rival.body)
  )

  read = await read_elections(team)
  ok(
    'every row returned belongs to the team asked for',
    read.body.every((row) => row.tid === team),
    JSON.stringify(read.body.map((row) => row.tid))
  )
  ok(
    "no other team's amount appears",
    !read.body.some((row) => row.maximum_bid === 99),
    JSON.stringify(read.body.filter((row) => row.maximum_bid === 99))
  )
  partial(
    'a manager cannot read a rival team’s ceilings',
    'league ' +
      lid +
      ' deliberately has one member, so there is no second ' +
      'identity here to be refused; the authorization branch is covered by ' +
      'test/auction.election-scope.spec.mjs'
  )

  const withdraw_maximum = await withdraw(team, pid)
  ok(
    'a maximum can be withdrawn',
    withdraw_maximum.status === 200,
    JSON.stringify(withdraw_maximum.body)
  )
  read = await read_elections(team)
  ok(
    'a withdrawn maximum stops reading back',
    !read.body.some((row) => row.pid === pid),
    JSON.stringify(read.body.filter((row) => row.pid === pid))
  )

  const decline = await elect(team, pid, null)
  ok(
    'a decline is accepted',
    decline.status === 200,
    JSON.stringify(decline.body)
  )
  read = await read_elections(team)
  const declined = read.body.find((row) => row.pid === pid)
  ok(
    'a decline reads back as a null maximum, not a $0 one',
    declined && declined.maximum_bid === null,
    JSON.stringify(declined)
  )

  const withdraw_decline = await withdraw(team, pid)
  ok(
    'a decline can be withdrawn',
    withdraw_decline.status === 200,
    JSON.stringify(withdraw_decline.body)
  )
  read = await read_elections(team)
  ok(
    'the withdrawn decline stops reading back',
    !read.body.some((row) => row.pid === pid),
    JSON.stringify(read.body.filter((row) => row.pid === pid))
  )

  await withdraw(other_team, pid)
}

/**
 * A nomination, every eligible team electing, and a second-price settlement --
 * asserted on the wire of an ALREADY-CONNECTED client, because the claim is
 * that a loaded page moves.
 */
const TOP_CEILING = 8
const SECOND_CEILING = 3
const EXPECTED_PRICE = SECOND_CEILING + 1

const drive_settlement = async (pids) => {
  const pid = pids[1]
  const client = await open_client({ tid: team_ids[0] })

  try {
    const init = await await_init(client)
    ok(
      'the socket boots in election mode',
      init.payload.auction_mode === AUCTION_MODES.ELECTION,
      init.payload.auction_mode
    )

    const nominator = await get_auction_nominating_team_id({ lid, season_year })
    must(
      'a team holds the nomination turn',
      Boolean(nominator),
      'rotation returned null'
    )

    // THE TWO CEILINGS MUST BOTH BE FUNDABLE, or the input cannot distinguish
    // second-price from anything else. A team's effective maximum is
    // `min(stated, availableCap)`, and a cloned board leaves real teams with
    // real budgets -- one of league 119's has $0. Picking the first two team ids
    // put an unfundable $3 against a $0 cap, which capped to $0, tied with the
    // nominator's opening bid, and settled at $1 for reasons that had nothing to
    // do with the runner-up. Pick on the budget, not on the order.
    const funded = []
    for (const tid of team_ids) {
      if (tid === nominator) continue
      if ((await available_cap(tid)) >= TOP_CEILING) funded.push(tid)
    }
    must(
      'two teams can fund the ceilings this scenario needs',
      funded.length >= 2,
      `only ${funded.length} team(s) hold $${TOP_CEILING} of cap`
    )
    const [winner, runner_up] = funded

    // Two ceilings placed BEFORE the nomination, which is the design's whole
    // point: an election is a standing instruction, not an answer to a prompt.
    must(
      'the top ceiling is accepted',
      (await elect(winner, pid, TOP_CEILING)).status === 200,
      `elect ${TOP_CEILING}`
    )
    must(
      'the second ceiling is accepted',
      (await elect(runner_up, pid, SECOND_CEILING)).status === 200,
      `elect ${SECOND_CEILING}`
    )

    const before_nomination = client.mark()
    client.send({
      type: 'AUCTION_SUBMIT_NOMINATION',
      payload: {
        pid,
        value: 0,
        tid: nominator,
        user_id: league_row.commissioner_user_id
      }
    })

    const opening = await client.await_message('AUCTION_BID', {
      from: before_nomination,
      where: (message) => message.payload.pid === pid
    })
    must(
      'the nomination reaches the wire',
      Boolean(opening),
      'no AUCTION_BID for the nominated player'
    )
    ok(
      'the nomination is recorded to the team on the clock',
      opening.payload.tid === nominator,
      `${opening.payload.tid} != ${nominator}`
    )

    const status = await settlement_status()
    must(
      'the settlement status reads',
      status.status === 200,
      JSON.stringify(status.body)
    )
    const outstanding = status.body.outstanding_election_tids
    ok(
      'the nominator is not outstanding -- nominating is bidding',
      !outstanding.includes(nominator),
      JSON.stringify(outstanding)
    )
    ok(
      'the two teams that already elected are not outstanding',
      !outstanding.includes(winner) && !outstanding.includes(runner_up),
      JSON.stringify(outstanding)
    )
    must(
      'at least one team is outstanding',
      outstanding.length >= 1,
      JSON.stringify(outstanding)
    )

    const winner_cap_before = await available_cap(winner)

    // Every remaining eligible team declines, one at a time, exactly as nine
    // managers would. The last one completes the set and settles the player.
    let settlement = null
    for (let index = 0; index < outstanding.length; index++) {
      const tid = outstanding[index]
      const is_last = index === outstanding.length - 1
      const mark = client.mark()
      const response = await elect(tid, pid, null)
      must(
        `team ${tid} can decline`,
        response.status === 200,
        JSON.stringify(response.body)
      )

      if (!is_last) {
        // MATCHED ON CONTENT, not on arrival order. The socket broadcasts its
        // own status at nomination and each REST election broadcasts another,
        // all of them asynchronously after the response returns -- so "the next
        // AUCTION_SETTLEMENT_STATUS after this request" is routinely the
        // PREVIOUS one still in flight, and asserting on it reads as a
        // one-behind list that never shrinks. Wait for the message that says
        // what is being claimed.
        const shrunk = await client.await_message('AUCTION_SETTLEMENT_STATUS', {
          from: mark,
          where: (message) =>
            !message.payload.outstanding_election_tids.includes(tid)
        })
        ok(
          `the outstanding set shrinks on the wire after team ${tid}`,
          Boolean(shrunk),
          'no broadcast dropped this team from the outstanding set'
        )
      } else {
        settlement = { response, mark }
      }
    }

    const body = settlement.response.body
    must(
      'the completing election returns a settlement',
      Boolean(body.settlement),
      JSON.stringify(body)
    )
    ok(
      'the player settles to the highest ceiling',
      body.settlement.winner_tid === winner,
      `${body.settlement.winner_tid} != ${winner}`
    )
    ok(
      'the price is the second claim plus one increment',
      body.settlement.price === EXPECTED_PRICE,
      `price ${body.settlement.price}, expected ${EXPECTED_PRICE} (runner-up ${SECOND_CEILING} + 1)`
    )
    signed_pids.add(pid)

    // The four effects of the fan-out, three of which shipped missing once.
    const processed = await client.await_message('AUCTION_PROCESSED', {
      from: settlement.mark
    })
    ok('the sale reaches the wire', Boolean(processed), 'no AUCTION_PROCESSED')
    ok(
      'the sale carries the winner and the price',
      processed &&
        processed.payload.tid === winner &&
        processed.payload.player_salary === EXPECTED_PRICE,
      processed ? JSON.stringify(processed.payload) : 'absent'
    )

    const advanced = await client.await_message('AUCTION_NOMINATION_INFO', {
      from: settlement.mark
    })
    const expected_next = await get_auction_nominating_team_id({
      lid,
      season_year
    })
    ok(
      'the nomination turn advances on the wire',
      advanced && advanced.payload.nominating_team_id === expected_next,
      advanced
        ? `${advanced.payload.nominating_team_id} != ${expected_next}`
        : 'no AUCTION_NOMINATION_INFO -- the auction stalls here'
    )
    ok(
      'the turn actually moved off the nominator',
      advanced && advanced.payload.nominating_team_id !== nominator,
      advanced ? String(advanced.payload.nominating_team_id) : 'absent'
    )

    const message = await format_nomination_complete_message({
      player_id: pid,
      winning_bid_amount: body.settlement.price,
      winning_team_id: winner
    })
    ok(
      'a settlement message is producible from this sale',
      Boolean(message && message.length),
      String(message)
    )
    partial(
      'the settlement Discord message is delivered',
      'both webhook columns are null on this league by design and ' +
        'send-notifications refuses outside NODE_ENV=production, so no ' +
        'delivery can be observed here'
    )

    // The outcome on every losing election, which is the half a settlement
    // assertion usually skips.
    const rows = await db('auction_elections').where({ lid, season_year, pid })
    const by_tid = new Map(rows.map((row) => [row.tid, row]))
    ok(
      'the winner is marked won',
      by_tid.get(winner)?.outcome === auction_election_outcomes.WON,
      JSON.stringify(by_tid.get(winner))
    )
    ok(
      'the runner-up is marked outbid',
      by_tid.get(runner_up)?.outcome === auction_election_outcomes.OUTBID,
      JSON.stringify(by_tid.get(runner_up))
    )
    ok(
      'every decline is marked declined',
      outstanding.every(
        (tid) => by_tid.get(tid)?.outcome === auction_election_outcomes.DECLINED
      ),
      JSON.stringify(outstanding.map((tid) => [tid, by_tid.get(tid)?.outcome]))
    )
    ok(
      'every election on the player is settled',
      rows.every((row) => row.settled_at),
      JSON.stringify(
        rows.filter((row) => !row.settled_at).map((row) => row.tid)
      )
    )

    const roster_row = await db('rosters_players')
      .where({ lid, season_year, pid })
      .first()
    ok(
      'the winner is rostered',
      roster_row && roster_row.tid === winner,
      JSON.stringify(roster_row)
    )
    // THE BUDGET HALF OF MONOTONICITY. A roster count cannot see it, and a team
    // whose remaining cap rose across a settlement re-enters eligible sets it
    // had left -- so completeness would stop staying reached.
    const cap_after = await available_cap(winner)
    ok(
      'the price is charged to the winner, exactly once',
      cap_after === winner_cap_before - EXPECTED_PRICE,
      `availableCap ${winner_cap_before} -> ${cap_after}, expected a fall of ${EXPECTED_PRICE}`
    )
  } finally {
    client.socket.close()
  }
}

/**
 * Nine opt-ins, the tenth, a merge, a withdrawal after finalization, and a slot
 * inside the notice threshold.
 */
const drive_blocks = async () => {
  const client = await open_client({ tid: team_ids[0] })

  try {
    await await_init(client)

    const schedule = await read_schedule()
    must(
      'the block schedule reads',
      schedule.status === 200,
      JSON.stringify(schedule.body)
    )
    const eligible = schedule.body.eligible_team_ids
    must(
      'there are eligible teams',
      eligible.length > 0,
      JSON.stringify(eligible)
    )
    const notice = schedule.body.auction_block_notice_minutes
    ok(
      'the notice threshold is carried on the payload',
      notice > 0,
      String(notice)
    )

    // Comfortably outside the notice threshold, and its neighbour for the merge.
    const slot = floor_to_block(dayjs().add(notice + 120, 'minute'))
    const next_slot = slot.add(15, 'minute')

    for (const tid of eligible.slice(0, -1)) {
      const response = await set_opt_in(tid, slot.unix())
      must(
        `team ${tid} can opt in`,
        response.status === 200,
        JSON.stringify(response.body)
      )
    }

    let current = await read_schedule()
    ok(
      'a slot short of unanimity does not convene',
      !current.body.blocks.some((block) => block.block_at === slot.unix()),
      JSON.stringify(current.body.blocks)
    )
    ok(
      'the opt-ins are visible and named',
      current.body.opt_ins.some(
        (entry) =>
          entry.block_at === slot.unix() &&
          entry.opt_in_tids.length === eligible.length - 1
      ),
      JSON.stringify(current.body.opt_ins)
    )

    const mark = client.mark()
    const last = eligible[eligible.length - 1]
    const finalizing = await set_opt_in(last, slot.unix())
    must(
      'the last opt-in is accepted',
      finalizing.status === 200,
      JSON.stringify(finalizing.body)
    )

    const convened = finalizing.body.blocks.find(
      (block) => block.block_at === slot.unix()
    )
    ok(
      'the tenth opt-in convenes the block',
      Boolean(convened),
      JSON.stringify(finalizing.body.blocks)
    )
    ok(
      'the session runs one granularity',
      convened && convened.end_at === next_slot.unix(),
      convened ? `${convened.block_at} -> ${convened.end_at}` : 'absent'
    )
    ok(
      'the unanimity denominator is frozen on the row',
      convened && convened.eligible_team_count === eligible.length,
      convened ? String(convened.eligible_team_count) : 'absent'
    )

    const broadcast = await client.await_message('AUCTION_BLOCK_SCHEDULE', {
      from: mark
    })
    ok(
      'the schedule reaches an open calendar',
      broadcast &&
        broadcast.payload.blocks.some(
          (block) => block.block_at === slot.unix()
        ),
      broadcast
        ? JSON.stringify(broadcast.payload.blocks)
        : 'no AUCTION_BLOCK_SCHEDULE'
    )

    const announcement = await format_block_convened_message({
      block_at: slot.toDate(),
      end_at: next_slot.toDate(),
      eligible_team_count: eligible.length,
      is_extension: false
    })
    ok(
      'a convening message is producible',
      Boolean(announcement && announcement.length),
      String(announcement)
    )
    const extension = await format_block_convened_message({
      block_at: slot.toDate(),
      end_at: next_slot.add(15, 'minute').toDate(),
      eligible_team_count: eligible.length,
      is_extension: true
    })
    ok(
      'a merge announces an extension rather than a second block',
      Boolean(extension) && extension !== announcement,
      `${announcement} / ${extension}`
    )
    partial(
      'the block announcement is delivered once',
      'delivery cannot be observed on a webhook-less league, and the injected ' +
        'announcer that makes the call count assertable is reachable only ' +
        'in-process; test/auction.blocks.spec.mjs holds that half'
    )

    // Consecutive unanimous slots run as ONE session.
    for (const tid of eligible) {
      const response = await set_opt_in(tid, next_slot.unix())
      must(
        `team ${tid} can opt into the next slot`,
        response.status === 200,
        JSON.stringify(response.body)
      )
    }
    current = await read_schedule()
    const sessions = current.body.blocks.filter(
      (block) =>
        block.block_at >= slot.unix() &&
        block.block_at < next_slot.add(15, 'minute').unix()
    )
    ok(
      'two consecutive unanimous slots merge to one session',
      sessions.length === 1 &&
        sessions[0].end_at === next_slot.add(15, 'minute').unix(),
      JSON.stringify(current.body.blocks)
    )

    // A withdrawal after finalization does not cancel.
    const withdrawn = await set_opt_in(eligible[0], slot.unix(), false)
    must(
      'a withdrawal is accepted',
      withdrawn.status === 200,
      JSON.stringify(withdrawn.body)
    )
    current = await read_schedule()
    ok(
      'a withdrawal after finalization does not cancel the block',
      current.body.blocks.some(
        (block) =>
          block.block_at === slot.unix() &&
          block.end_at === next_slot.add(15, 'minute').unix()
      ),
      JSON.stringify(current.body.blocks)
    )

    // Unanimity inside the notice threshold lapses.
    const near = floor_to_block(dayjs().add(Math.floor(notice / 2), 'minute'))
    for (const tid of eligible) {
      const response = await set_opt_in(tid, near.unix())
      must(
        `team ${tid} can opt into the near slot`,
        response.status === 200,
        JSON.stringify(response.body)
      )
    }
    current = await read_schedule()
    ok(
      'a unanimous slot inside the notice threshold lapses',
      !current.body.blocks.some((block) => block.block_at === near.unix()),
      JSON.stringify(current.body.blocks)
    )

    return { slot, end_at: next_slot.add(15, 'minute') }
  } finally {
    client.socket.close()
  }
}

/** Election before a block, live inside it, election after -- and the final block. */
const drive_modes = async (session) => {
  must(
    'a finalized session is available',
    Boolean(session),
    'the blocks scenario did not run'
  )

  const before = await get_auction_mode({
    lid,
    now: session.slot.subtract(1, 'minute')
  })
  ok(
    'election one minute before the block',
    before.auction_mode === AUCTION_MODES.ELECTION,
    before.auction_mode
  )

  const at_start = await get_auction_mode({ lid, now: session.slot })
  ok(
    'live at the block start',
    at_start.auction_mode === AUCTION_MODES.LIVE,
    at_start.auction_mode
  )
  ok(
    'the block end travels with the mode',
    at_start.block_end_at &&
      dayjs(at_start.block_end_at).valueOf() === session.end_at.valueOf(),
    String(at_start.block_end_at)
  )

  const inside = await get_auction_mode({
    lid,
    now: session.end_at.subtract(1, 'minute')
  })
  ok(
    'live inside the block',
    inside.auction_mode === AUCTION_MODES.LIVE,
    inside.auction_mode
  )

  const at_end = await get_auction_mode({ lid, now: session.end_at })
  ok(
    'election again at end_at -- the interval is half-open',
    at_end.auction_mode === AUCTION_MODES.ELECTION,
    at_end.auction_mode
  )

  // The final block is resolved through the pure rule against the values the
  // route actually serves. `get_auction_mode` is not called at a far-future
  // instant on purpose: `get_auction_final_block` emits a pipeline_failure
  // signal for a computation landing in the past, and a test run must not
  // manufacture one.
  const schedule = await read_schedule()
  const final_block_at = schedule.body.final_block_at
  const period_end = schedule.body.period_end
  must(
    'the route serves a computed final block',
    Boolean(final_block_at),
    JSON.stringify(schedule.body)
  )
  ok(
    'the final block sits inside the period',
    final_block_at < period_end,
    `${final_block_at} vs ${period_end}`
  )
  ok(
    'the final block is sized on unfilled roster spots',
    Number.isInteger(schedule.body.final_block_spots_remaining),
    String(schedule.body.final_block_spots_remaining)
  )

  const blocks = schedule.body.blocks.map((block) => ({
    block_at: dayjs.unix(block.block_at),
    end_at: dayjs.unix(block.end_at)
  }))
  const at_final = resolve_auction_mode_at({
    now: dayjs.unix(final_block_at),
    blocks,
    final_block_at: dayjs.unix(final_block_at),
    period_end: dayjs.unix(period_end)
  })
  ok(
    'live from the final block',
    at_final.auction_mode === AUCTION_MODES.LIVE,
    at_final.auction_mode
  )
  ok(
    'the final block is flagged as final',
    at_final.is_final_block === true,
    String(at_final.is_final_block)
  )

  const mid_final = resolve_auction_mode_at({
    now: dayjs.unix(final_block_at).add(1, 'hour'),
    blocks,
    final_block_at: dayjs.unix(final_block_at),
    period_end: dayjs.unix(period_end)
  })
  ok(
    'live continues from the final block to the period end',
    mid_final.auction_mode === AUCTION_MODES.LIVE,
    mid_final.auction_mode
  )

  const after_period = resolve_auction_mode_at({
    now: dayjs.unix(period_end),
    blocks,
    final_block_at: dayjs.unix(final_block_at),
    period_end: dayjs.unix(period_end)
  })
  ok(
    'the period end closes live mode',
    after_period.auction_mode === AUCTION_MODES.ELECTION,
    after_period.auction_mode
  )
}

/**
 * Proxy bidding inside a live block.
 *
 * The block's start is ARRANGED rather than convened: convening is driven over
 * the real routes in the blocks scenario, and the notice threshold means a
 * convened block is at minimum an hour away, which no test run can wait for.
 * Everything after the row insert is the real socket on real clocks.
 */
const PROXY_CEILING = 10
const HUMAN_BID = 5

const drive_proxy_bidding = async (pids) => {
  const pid = pids[2]
  const now = dayjs()
  const block_at = floor_to_block(now)
  const end_at = block_at.add(15, 'minute')

  const [inserted] = await db('auction_blocks')
    .insert({
      lid,
      season_year,
      block_at: block_at.toDate(),
      end_at: end_at.toDate(),
      finalized_at: now.toDate(),
      eligible_team_count: team_ids.length
    })
    .onConflict(['lid', 'season_year', 'block_at'])
    .ignore()
    .returning('*')
  must(
    'a live block can be arranged',
    Boolean(inserted),
    'the slot was already finalized'
  )

  const client = await open_client({ tid: team_ids[0] })
  try {
    const init = await await_init(client)

    // A socket booting INSIDE a block starts with `_election_mode` false, which
    // is a real mode rather than "unknown" -- so the first resolve has to
    // transition even when it agrees with the default, or the block convenes and
    // then does nothing at all.
    ok(
      'a socket booting inside a block is in live mode',
      init.payload.auction_mode === AUCTION_MODES.LIVE,
      init.payload.auction_mode
    )
    ok(
      'the block end is on the init payload',
      init.payload.block_end_at === end_at.unix(),
      `${init.payload.block_end_at} != ${end_at.unix()}`
    )

    const nominator = await get_auction_nominating_team_id({ lid, season_year })

    // BOTH SIDES HAVE TO BE ABLE TO AFFORD THEIR PART, and neither is chosen by
    // team id. `_validate_bid` refuses a bid above the team's cached cap and
    // replies AUCTION_ERROR rather than broadcasting anything, so an unfunded
    // bidder produces exactly the same silence as a proxy engine that never
    // fired -- which is how this first read as a missing engine answer when it
    // was a $0 team being correctly refused.
    const solvent = []
    for (const tid of team_ids) {
      if (tid === nominator) continue
      if ((await available_cap(tid)) >= PROXY_CEILING) solvent.push(tid)
    }
    must(
      'two teams can fund a contested block bid',
      solvent.length >= 2,
      `only ${solvent.length} team(s) hold $${PROXY_CEILING} of cap`
    )
    const [ceiling_holder, human] = solvent

    must(
      'a standing ceiling is accepted before the nomination',
      (await elect(ceiling_holder, pid, PROXY_CEILING)).status === 200,
      `elect ${PROXY_CEILING}`
    )

    const before = client.mark()
    client.send({
      type: 'AUCTION_SUBMIT_NOMINATION',
      payload: {
        pid,
        value: 0,
        tid: nominator,
        user_id: league_row.commissioner_user_id
      }
    })

    const opening = await client.await_message('AUCTION_BID', {
      from: before,
      where: (message) =>
        message.payload.pid === pid && message.payload.tid === nominator
    })
    must('the nomination opens the player', Boolean(opening), 'no opening bid')

    // Every standing maximum is a live proxy the moment the player opens, so the
    // price jumps to the equilibrium without waiting for a human to move.
    const opening_proxy = await client.await_message('AUCTION_BID', {
      from: before,
      where: (message) =>
        message.payload.pid === pid && message.payload.tid === ceiling_holder
    })
    ok(
      'a standing ceiling proxies the moment the player opens',
      Boolean(opening_proxy),
      'no engine bid after the nomination'
    )
    ok(
      'the proxy spends only what it takes to lead',
      opening_proxy && opening_proxy.payload.player_salary === 1,
      opening_proxy ? String(opening_proxy.payload.player_salary) : 'absent'
    )

    const before_human = client.mark()
    client.send({
      type: 'AUCTION_BID',
      payload: {
        pid,
        value: HUMAN_BID,
        tid: human,
        user_id: league_row.commissioner_user_id
      }
    })

    const human_bid = await client.await_message('AUCTION_BID', {
      from: before_human,
      where: (message) =>
        message.payload.pid === pid && message.payload.tid === human
    })
    // A REFUSED BID IS SILENT ON THE BROADCAST and speaks only on AUCTION_ERROR,
    // so the refusal has to be read before concluding anything about the engine.
    const refusal = await client.await_message('AUCTION_ERROR', {
      from: before_human,
      timeout_ms: 3000
    })
    must(
      'the human bid is accepted',
      Boolean(human_bid) && !refusal,
      refusal ? refusal.payload.error : 'no AUCTION_BID for the human bidder'
    )

    const answered = await client.await_message('AUCTION_BID', {
      from: before_human,
      where: (message) =>
        message.payload.pid === pid &&
        message.payload.tid === ceiling_holder &&
        message.payload.player_salary > 1
    })
    ok(
      'a human bid is answered by the ceiling',
      Boolean(answered),
      'no engine answer to the human bid'
    )
    ok(
      'the answer is one increment above the human bid, not the ceiling',
      answered && answered.payload.player_salary === HUMAN_BID + 1,
      answered
        ? `${answered.payload.player_salary}, expected ${HUMAN_BID + 1}`
        : 'absent'
    )
    partial(
      'the engine step does not reset the bid clock',
      'the bid clock is not on the wire -- no broadcast carries an expiry, so ' +
        'it is unobservable from a client; test/auction.proxy-bidding.spec.mjs ' +
        'holds it through the injected timer'
    )
  } finally {
    client.socket.close()
  }
}

// ============================================================================
// MAIN
// ============================================================================

const main = async () => {
  await assert_target_is_safe()

  // The recovery path for a run that was killed before its own teardown, which
  // is the state that matters: a finalized block left on the mirror puts a
  // league ten managers hold a team in into live mode on a wall clock.
  if (args.teardown_only) {
    await teardown()
    return true
  }

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  base_url = `http://127.0.0.1:${server.address().port}`
  process.stdout.write(`working-tree API on ${base_url}\n`)

  await teardown()
  await assert_board_is_clean()

  const pids = await pick_free_agents({ count: 3 })
  process.stdout.write(`free agents for this run: ${pids.join(', ')}\n`)

  let session = null
  await scenario('elections', () => drive_elections(pids))
  await scenario('settlement', () => drive_settlement(pids))
  await scenario('blocks', async () => {
    session = await drive_blocks()
  })
  await scenario('modes', () => drive_modes(session))
  await scenario('proxy-bidding', () => drive_proxy_bidding(pids))

  if (!args.keep) await teardown()
  else
    process.stdout.write(
      '\nteardown SKIPPED (--keep): this league is now dirty\n'
    )

  process.stdout.write('\n' + '='.repeat(60) + '\n')
  let failed = 0
  for (const entry of scenarios) {
    const counts = { PASS: 0, FAIL: 0, 'N/A': 0 }
    for (const check of entry.checks) counts[check.status]++
    failed += counts.FAIL + (entry.error ? 1 : 0)
    process.stdout.write(
      `${entry.name.padEnd(16)} ${counts.PASS} passed, ${counts.FAIL} failed, ` +
        `${counts['N/A']} not drivable, ${entry.seconds}s` +
        `${entry.error ? ' (ABORTED)' : ''}\n`
    )
  }
  process.stdout.write('='.repeat(60) + '\n')

  if (failed) {
    process.stdout.write(`\n${failed} failure(s)\n`)
    for (const entry of scenarios) {
      for (const check of entry.checks) {
        if (check.status === 'FAIL') {
          process.stdout.write(
            `  ${entry.name}: ${check.label} -- ${check.detail}\n`
          )
        }
      }
      if (entry.error)
        process.stdout.write(
          `  ${entry.name}: ABORTED -- ${entry.error.message}\n`
        )
    }
  }

  return failed === 0
}

let clean = false
try {
  clean = await main()
} catch (error) {
  process.stderr.write(`\n${error.stack}\n`)
  // The teardown runs even on an unexpected throw. Rows left on the mirror put
  // a league ten managers hold a team in into live mode on a wall clock.
  if (!args.keep) {
    try {
      await teardown()
    } catch (teardown_error) {
      process.stderr.write(`TEARDOWN FAILED: ${teardown_error.message}\n`)
    }
  }
}

server.close()
// The pool is NOT destroyed. `#api` holds connections this process never asked
// for, so `knex.destroy` aborts their pending acquisitions, and each abort is a
// separate unhandled rejection that crashes the process AFTER the report has
// printed and every write has committed -- a green run that exits looking red.
// `process.exit` drops them with the process.
process.exit(clean ? 0 : 1)
