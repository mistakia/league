module.exports = {
  apps: [
    {
      name: 'import-live-plays-worker',
      script: 'jobs/import-live-plays-worker.mjs',
      args: '--config /root/league/config.production.js',
      watch: '.',
      autorestart: true,
      max_memory_restart: '1G',
      merge_logs: true,
      env_production: {
        NODE_ENV: 'production',
        DEBUG: 'import-live-plays-worker,import-plays-nfl-v1,finalize-game'
      }
    }
  ]
}
