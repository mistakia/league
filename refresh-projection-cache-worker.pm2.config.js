// Runs on the MAIN host (league), not digitalocean-0: it rebuilds projection
// cache slices for leagues whose commissioner just changed a scoring or roster
// setting, so it belongs beside the API that accepts those edits and the
// database it reads. `script`/`cwd` are absolute for the same reason as
// server.pm2.config.js -- a relative path lets a `pm2 start` from the wrong cwd
// silently re-root the app at a stale tree.
//
// BASE_API_URL is deliberately NOT set here; it is inherited from the
// environment pm2 was started with, exactly as `server` does. Note this does
// NOT decide whether the worker reports: `report_run_outcome` gates on a
// runnable base CLI and on NODE_ENV=production, never on BASE_API_URL, because
// on a writer host base's job-wrapper strips that variable so `base run report`
// writes over the local UDS instead. Reading its absence as "unreportable" is
// the mistake that made every league job on base-storage report nowhere for
// eleven days.
//
// NODE_ENV=production below is therefore load-bearing for the ledger rows, not
// just for config selection -- this worker must be started with
// `--env production` or it rebuilds correctly while reporting nothing.
const require_machine_slug = require('./server/pm2-machine-slug')

module.exports = {
  apps: [
    {
      name: 'refresh-projection-cache-worker',
      script: '/root/league/jobs/refresh-projection-cache-worker.mjs',
      cwd: '/root/league',
      autorestart: true,
      min_uptime: '60s',
      max_restarts: 10,
      max_memory_restart: '1G',
      merge_logs: true,
      env_production: {
        NODE_ENV: 'production',
        DEBUG:
          'refresh-projection-cache-worker,process-projections-for-scoring-format,process-projections-for-league-format',
        BASE_MACHINE_SLUG: require_machine_slug(),
        BASE_INSTANCE_KEY_FILE: '/root/.base-instance-private.key',
        USER_BASE_DIRECTORY:
          process.env.USER_BASE_DIRECTORY ||
          `${process.env.HOME || '/root'}/.base-stub`
      }
    }
  ]
}
