// Runs on the MAIN host (league), not digitalocean-0: it rebuilds projection
// cache slices for leagues whose commissioner just changed a scoring or roster
// setting, so it belongs beside the API that accepts those edits and the
// database it reads. `script`/`cwd` are absolute for the same reason as
// server.pm2.config.js -- a relative path lets a `pm2 start` from the wrong cwd
// silently re-root the app at a stale tree.
//
// BASE_API_URL is deliberately NOT set here. `report_run_outcome` no-ops
// without it, so the worker still rebuilds correctly and only loses its ledger
// rows; it inherits the variable from the environment pm2 was started with,
// exactly as `server` does.
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
        BASE_MACHINE_SLUG: 'league',
        BASE_INSTANCE_KEY_FILE: '/root/.base-instance-private.key',
        USER_BASE_DIRECTORY:
          process.env.USER_BASE_DIRECTORY ||
          `${process.env.HOME || '/root'}/.base-stub`
      }
    }
  ]
}
