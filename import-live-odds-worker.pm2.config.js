module.exports = {
  apps: [
    {
      name: 'import-live-odds-worker',
      script: 'jobs/import-live-odds-worker.mjs',
      autorestart: true,
      min_uptime: '60s',
      max_restarts: 10,
      max_memory_restart: '1G',
      merge_logs: true,
      env_production: {
        NODE_ENV: 'production',
        CONFIG_ENCRYPTION_KEY_FILE: process.env.CONFIG_ENCRYPTION_KEY_FILE,
        DEBUG: 'import-live-odds-worker,draftkings,pinnacle,prizepicks',
        USER_BASE_DIRECTORY:
          process.env.USER_BASE_DIRECTORY ||
          `${process.env.HOME || '/root'}/.base-stub`
      }
    }
  ]
}
