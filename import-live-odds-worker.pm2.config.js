module.exports = {
  apps: [
    {
      name: 'import-live-odds-worker',
      script: '/root/league/jobs/import-live-odds-worker.mjs',
      cwd: '/root/league',
      autorestart: true,
      min_uptime: '60s',
      max_restarts: 10,
      max_memory_restart: '1G',
      merge_logs: true,
      env_production: {
        NODE_ENV: 'production',
        DEBUG: 'import-live-odds-worker,draftkings,pinnacle,prizepicks',
        BASE_MACHINE_SLUG: 'digitalocean-0',
        BASE_INSTANCE_KEY_FILE: '/root/.base-instance-private.key',
        USER_BASE_DIRECTORY:
          process.env.USER_BASE_DIRECTORY ||
          `${process.env.HOME || '/root'}/.base-stub`
      }
    }
  ]
}
