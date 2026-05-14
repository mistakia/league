module.exports = {
  apps: [
    {
      name: 'import-live-plays-worker',
      script: 'jobs/import-live-plays-worker.mjs',
      watch: '.',
      autorestart: true,
      max_memory_restart: '1G',
      merge_logs: true,
      env_production: {
        NODE_ENV: 'production',
        CONFIG_ENCRYPTION_KEY: process.env.CONFIG_ENCRYPTION_KEY,
        CONFIG_ENCRYPTION_KEY_FILE: process.env.CONFIG_ENCRYPTION_KEY_FILE,
        DEBUG: 'import-live-plays-worker,import-plays-nfl-v1,finalize-game'
      }
    }
  ]
}
