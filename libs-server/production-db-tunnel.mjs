import net from 'node:net'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { load_sops_json } from '#config'

/**
 * Point `#db` at the production database over an ssh tunnel.
 *
 * WHY THIS EXISTS. Production postgres is not reachable from a laptop, so a
 * script that names production as its target dies on a knex pool timeout
 * several seconds into its first query -- far from the line that chose the
 * target, and indistinguishable from the database being down.
 * scripts/drive-auction-end-to-end.mjs carried the fix inline;
 * scripts/clone-league.mjs did not, which is why the re-sync recipe printed in
 * the drive script's own header could not be run from the machine that prints
 * it. This is that bootstrap, in one place, so the next production-targeting
 * script inherits it rather than rediscovering it.
 *
 * IMPORT ORDER MATTERS. `#db` reads LEAGUE_DB_* once at module load, so this
 * must run BEFORE `#db` is imported -- which means the caller imports `#db`
 * dynamically, below its call to this. A static `import ... from '#db'` hoists
 * above every statement in the calling file and binds to the wrong database.
 *
 * NOT for the test suite. Under NODE_ENV=test the caller is being pointed at a
 * local fixture database by its runner, and opening a tunnel would aim a spec
 * at production. Callers guard on that; see scripts/clone-league.mjs.
 */

const repo_root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

export const is_port_open = (port) =>
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

/**
 * Open the tunnel if nothing is already listening, and set LEAGUE_DB_* so the
 * next `#db` import binds to it.
 *
 * The credentials are derived at runtime through the same fail-closed sops
 * shell-out the config loader uses, and reach `#db` through the environment of
 * this process only. No credential is ever an argument, a printed command, or a
 * file on disk.
 *
 * @param {{ db_port?: number, ssh_host?: string, log?: (message: string) => void }} [options]
 */
export const open_production_db_tunnel = async ({
  db_port = 15433,
  ssh_host = 'league',
  log = (message) => process.stdout.write(message)
} = {}) => {
  const production = load_sops_json(
    path.join(repo_root, 'config', 'config-production.json')
  )

  if (!(await is_port_open(db_port))) {
    log(`opening ssh tunnel 127.0.0.1:${db_port} -> ${ssh_host}:5432\n`)
    // ConnectTimeout and BatchMode are what make a failure a FAILURE. Without
    // them a bad host name leaves ssh waiting on a resolver or a filtered port
    // with no bound, and a host missing its key drops to an interactive
    // password prompt on a stdio nobody is watching -- both of which present as
    // a script that has hung, which is the one outcome this repo treats as
    // indistinguishable from a bug elsewhere.
    const result = spawnSync('ssh', [
      '-f',
      '-N',
      '-o',
      'BatchMode=yes',
      '-o',
      'ConnectTimeout=10',
      '-L',
      `${db_port}:127.0.0.1:5432`,
      ssh_host
    ])
    if (result.status !== 0) {
      throw new Error(`could not open an ssh tunnel to ${ssh_host}`)
    }
    // Deliberately left open rather than torn down: an idle tunnel is harmless,
    // concurrent sessions share this port, and killing by process pattern would
    // take out a sibling's tunnel opened with the same spec.
  }

  process.env.LEAGUE_DB_HOST = '127.0.0.1'
  process.env.LEAGUE_DB_PORT = String(db_port)
  process.env.LEAGUE_DB_DATABASE = production.postgres.connection.database
  process.env.LEAGUE_DB_USER = production.postgres.connection.user
  process.env.LEAGUE_DB_PASSWORD = String(
    production.postgres.connection.password
  )

  return {
    db_port,
    ssh_host,
    database: production.postgres.connection.database
  }
}
