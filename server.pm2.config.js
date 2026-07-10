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
        CONFIG_ENCRYPTION_KEY_FILE: process.env.CONFIG_ENCRYPTION_KEY_FILE,
        BASE_MACHINE_SLUG: 'league',
        BASE_INSTANCE_KEY_FILE: '/root/.base-instance-private.key'
      },
      max_memory_restart: '3G',
      node_args: '--max-old-space-size=3072'
    }
  ]
}
