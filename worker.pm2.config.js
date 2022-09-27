module.exports = {
  apps: [
    {
      script: 'worker.mjs',
      args: '--config /root/league/config.production.js',
      watch: '.',
      env_production: {
        NODE_ENV: 'production'
      },
      max_memory_restart: '2G'
    }
  ]
}
