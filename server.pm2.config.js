// Single-tree deploy: the PM2 app runs from /root/league — the same clone the
// crontab scripts use. `script`/`cwd` are absolute so `pm2 start` registers the
// correct path regardless of the invoking shell's working directory; a relative
// `script` here is what let a `pm2 start` from the wrong cwd silently re-root the
// app at a stale tree and serve a months-old bundle (see
// user:text/league/league-server.md § Deployment Topology). Deploy with
// `yarn deploy` (git pull + yarn install + pm2 reload) — no pm2-deploy layer.
module.exports = {
  apps: [
    {
      name: 'server',
      script: '/root/league/server.mjs',
      cwd: '/root/league',
      autorestart: true,
      min_uptime: '60s',
      max_restarts: 10,
      env_production: {
        NODE_ENV: 'production',
        // Pinned here, not inherited from /etc/environment: a `pm2 delete` then
        // `pm2 start` from a shell lacking these would otherwise run the API
        // with every emit_signal silently muted (the transport no-ops when the
        // variables are unset).
        BASE_API_URL: 'https://base.tint.space',
        BASE_MACHINE_SLUG: 'league',
        BASE_INSTANCE_KEY_FILE: '/root/.base-instance-private.key',
        // The data-view generation identity, distinct from the instance key
        // above: BASE_INSTANCE_KEY_FILE signs signals as this MACHINE, this one
        // mints container sessions as the generation IDENTITY. Named here
        // rather than left to the module default so that a host reading this
        // file learns the API process depends on a second key, and where.
        // Redundant with resolve_identity_key_path's default today, and
        // deliberately so: pm2 re-reads this file only on a delete-then-start,
        // never on a reload, so a value that differed from the default would
        // not be live until someone did one.
        LEAGUE_GENERATION_IDENTITY_KEY_FILE:
          '/root/.league-data-view-generation-identity.key'
      },
      max_memory_restart: '3G',
      node_args: '--max-old-space-size=3072'
    }
  ]
}
