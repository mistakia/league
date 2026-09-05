/**
 * Fail-closed guard for destructive database operations.
 *
 * The hazard this exists for: config/config-development.json was tracked in git
 * pointing at the production host and league_production, so the only thing
 * between `NODE_ENV=development mocha --require test/global.mjs` and a dropped
 * production database was an empty password field. test/global.mjs's
 * mochaGlobalSetup enumerates pg_tables and issues DROP TABLE ... CASCADE on
 * every table in the public schema of whatever #db resolved to -- it does not
 * care which database that is.
 *
 * Three design rules follow from that finding, and none is negotiable:
 *
 *   1. ASSERT ON THE RESOLVED TARGET, NOT ON NODE_ENV. The label already lied
 *      once. `current_database()` is asked of the live server, over the same
 *      connection the destructive statement will run on, so it cannot be
 *      desynchronized from config, from an env override, or from an SSH tunnel.
 *   2. FAIL CLOSED. Missing connection info, an unreadable server response, a
 *      database name nobody has vouched for, a host that is not loopback --
 *      every one of these REFUSES. There is no "unknown, therefore probably
 *      fine" branch, matching config/index.mjs's sops decrypt path.
 *   3. MAKE THE TARGET PROVE IT IS DISPOSABLE. Added 2026-09-05, because rules 1
 *      and 2 still could not tell two loopback servers apart: `host=127.0.0.1
 *      database=league_test` names both the :5433 test container and a Homebrew
 *      Postgres on :5432, so the wrong server's tables were one same-named
 *      database away from being dropped. A target must now carry a COMMENT
 *      declaring itself disposable. Provisioners stamp it; the suite never does.
 *
 * There is deliberately no environment-variable escape hatch and no allowlist
 * that config can extend. Both would reintroduce exactly the hole above: a
 * value set once in a shell profile, forgotten, and then ambient on every run.
 * The one consumer that legitimately points a non-production NODE_ENV at
 * production (scripts/dev-smoke.sh) is READ-ONLY by construction -- it opens the
 * session with default_transaction_read_only=on -- so it never reaches a
 * destructive call site and needs no exemption. If a genuine
 * destructive-against-production need ever appears (a disaster-recovery restore
 * is the plausible one), it should get its own single-purpose script that names
 * the target as an explicit argument, not a bypass flag threaded through here.
 */

// The database must say, in its own COMMENT, that it exists to be thrown away.
// This is the primary control; the name allowlist and the loopback test below
// are secondary and neither can replace it.
//
// The hole it closes: the other two conditions cannot tell two loopback servers
// apart. The macbook runs the test container on :5433 and a Homebrew Postgres on
// :5432, and `host=127.0.0.1 database=league_test` describes both -- so a
// `league_test` on the wrong server passed name-plus-loopback and would have had
// every table in it dropped. Port is not a fix: it is client-side config, the
// same thing this guard exists to distrust, and inside the container the server
// reports 5432 either way.
//
// Applied by the PROVISIONERS, never by the suite: db/test/init-roles.sql (docker
// first-init and CI) and scripts/test-isolated.sh at CREATE DATABASE. A target
// that stamped itself on the way to dropping itself would be no control at all.
//
// Survives teardown because test/global.mjs drops tables WHERE schemaname =
// 'public' and a database comment is not a table.
const DISPOSABLE_DATABASE_MARKER = 'league:disposable-test-database'

// Databases a destructive operation may target. Hardcoded, not config-derived
// and not env-extensible: the allowlist is the control, and a control that its
// own blast radius can edit is not one.
//
// Retained ALONGSIDE the marker rather than replaced by it. The marker proves
// disposability and the name proves nothing the marker does not -- but the two
// fail in different directions, and the cost of the redundancy is one string
// comparison against a mistakenly-stamped production database.
const ALLOWED_DATABASES = new Set([
  'league_test',
  'league_development',
  'league_local'
])

// CLAUDE.md's concurrency recipe gives a run its own database on the shared
// :5433 container (LEAGUE_DB_DATABASE=league_test_<slug>) so two worktree
// sessions do not drop each other's tables mid-run. Those are permitted by
// pattern rather than by name, since the slug is per-session. The pattern is
// deliberately anchored and narrow -- it cannot match league_production.
const ALLOWED_DATABASE_PATTERN = /^league_test_[a-z0-9_]+$/

const is_allowed_database = (database) =>
  ALLOWED_DATABASES.has(database) || ALLOWED_DATABASE_PATTERN.test(database)

// A permitted database NAME on a remote host is still refused. Both halves must
// hold, so restoring over a `league_test` that happens to live on the
// production server is caught even though its name looks harmless.
const LOOPBACK_HOSTS = new Set([
  '127.0.0.1',
  '::1',
  'localhost',
  '0:0:0:0:0:0:0:1'
])

const format_target = ({ host, port, database, user }) =>
  `host=${host ?? '<unset>'} port=${port ?? '<unset>'} database=${
    database ?? '<unset>'
  } user=${user ?? '<unset>'}`

const refuse = ({ operation, target, reason }) => {
  throw new Error(
    `REFUSED: ${operation} against a target that is not an approved ` +
      `non-production database.\n` +
      `  reason:   ${reason}\n` +
      `  resolved: ${format_target(target)}\n` +
      `  allowed:  databases {${[...ALLOWED_DATABASES].join(', ')}} or ` +
      `${ALLOWED_DATABASE_PATTERN}, on loopback only, AND carrying the ` +
      `database comment '${DISPOSABLE_DATABASE_MARKER}'\n` +
      `  This guard reads current_database() from the live server, not ` +
      `NODE_ENV. If you meant to run against a local database, point your ` +
      `config or LEAGUE_DB_* overrides at one; there is no bypass flag.`
  )
}

/**
 * Ask the live server what it actually is. Deliberately not read from config:
 * the whole point is to be immune to a config that disagrees with reality.
 */
const resolve_live_target = async ({ knex, operation }) => {
  let rows
  try {
    const result = await knex.raw(
      'SELECT current_database() AS database, current_user AS user, ' +
        'inet_server_addr()::text AS server_addr, ' +
        'shobj_description((SELECT oid FROM pg_database ' +
        "WHERE datname = current_database()), 'pg_database') AS marker"
    )
    rows = result?.rows
  } catch (error) {
    // An unreadable identity is an unverified identity.
    throw new Error(
      `REFUSED: ${operation} -- could not read the connection's identity from ` +
        `the server, so the target is unverified: ${error.message}`
    )
  }

  const row = rows?.[0]
  if (!row?.database) {
    throw new Error(
      `REFUSED: ${operation} -- the server returned no current_database(), so ` +
        `the target is unverified.`
    )
  }

  // Host comes from the pool config rather than inet_server_addr(), which is
  // NULL over a unix socket and, over an SSH tunnel, reports the far-end
  // server's own address rather than the one dialed. The client-side host is
  // what determines whether traffic left this machine.
  const connection = knex?.client?.config?.connection ?? {}

  return {
    database: row.database,
    user: row.user,
    host: connection.host,
    port: connection.port,
    server_addr: row.server_addr,
    marker: row.marker
  }
}

/**
 * Refuse unless the connection's live target is an approved non-production
 * database reached over loopback. Call this immediately before the destructive
 * statement, on the same knex instance that will execute it.
 *
 * @param {object} args
 * @param {import('knex').Knex} args.knex connection the destructive work runs on
 * @param {string} args.operation human description, quoted back in the refusal
 * @returns {Promise<object>} the verified target (host/port/database/user)
 */
export const assert_destructive_target_allowed = async ({
  knex,
  operation = 'destructive database operation'
} = {}) => {
  if (!knex?.raw) {
    throw new Error(
      `REFUSED: ${operation} -- no database connection was handed to the ` +
        `guard, so nothing could be verified.`
    )
  }

  const target = await resolve_live_target({ knex, operation })

  // Checked FIRST: it is the only condition that identifies the server rather
  // than describing the connection, so it is the one that catches a same-named
  // database on the wrong loopback instance.
  if (target.marker !== DISPOSABLE_DATABASE_MARKER) {
    refuse({
      operation,
      target,
      reason:
        `database "${target.database}" carries no disposability marker ` +
        `(found ${target.marker === null || target.marker === undefined ? 'none' : `"${target.marker}"`}), ` +
        `so it has not declared itself safe to destroy. If this really is a ` +
        `throwaway database, stamp it from a psql session on THAT server:\n` +
        `    COMMENT ON DATABASE "${target.database}" IS '${DISPOSABLE_DATABASE_MARKER}';\n` +
        `  A container created before this guard existed will not have it -- ` +
        `db/test/init-roles.sql only runs on first init of an empty volume. ` +
        `Check you are on the intended server first: the test container is ` +
        `:5433, not :5432`
    })
  }

  if (!is_allowed_database(target.database)) {
    refuse({
      operation,
      target,
      reason: `database "${target.database}" is not an approved destructive target`
    })
  }

  if (!target.host) {
    refuse({
      operation,
      target,
      reason:
        'the connection declares no host, so it cannot be shown to be local'
    })
  }

  if (!LOOPBACK_HOSTS.has(String(target.host))) {
    refuse({
      operation,
      target,
      reason: `host "${target.host}" is not loopback`
    })
  }

  return target
}

/**
 * Same rule MINUS the disposability marker, applied to a target described by
 * plain values rather than by a live connection. It holds no connection, so it
 * cannot ask the server for its comment and is left with exactly the
 * name-plus-loopback pair that cannot distinguish two loopback servers. Treat it
 * as the weaker form it is. For the shell-out paths (pg_restore, psql -f) that build a command
 * line instead of holding a knex handle. Weaker than the connection form -- it
 * trusts the caller's strings -- so prefer the connection form wherever a pool
 * exists.
 */
export const assert_destructive_target_values_allowed = ({
  host,
  port,
  database,
  user,
  operation = 'destructive database operation'
} = {}) => {
  const target = { host, port, database, user }

  if (!database) {
    refuse({
      operation,
      target,
      reason: 'no database name was resolved, so the target is unverified'
    })
  }

  if (!is_allowed_database(database)) {
    refuse({
      operation,
      target,
      reason: `database "${database}" is not an approved destructive target`
    })
  }

  if (!host) {
    refuse({
      operation,
      target,
      reason:
        'the connection declares no host, so it cannot be shown to be local'
    })
  }

  if (!LOOPBACK_HOSTS.has(String(host))) {
    refuse({ operation, target, reason: `host "${host}" is not loopback` })
  }

  return target
}

export {
  ALLOWED_DATABASES,
  ALLOWED_DATABASE_PATTERN,
  DISPOSABLE_DATABASE_MARKER,
  LOOPBACK_HOSTS,
  is_allowed_database
}
