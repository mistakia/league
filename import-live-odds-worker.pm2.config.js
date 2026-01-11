module.exports = {
  apps: [
    {
      name: 'import-live-odds-worker',
      script: 'jobs/import-live-odds-worker.mjs',
      watch: '.',
      autorestart: true,
      max_memory_restart: '1G',
      merge_logs: true,
      env_production: {
        NODE_ENV: 'production',
        CONFIG_ENCRYPTION_KEY: process.env.CONFIG_ENCRYPTION_KEY,
        DEBUG: 'import-live-odds-worker,draftkings,pinnacle,prizepicks'
      }
    }
  ]
}
