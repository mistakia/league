module.exports = {
  apps: [
    {
      script: 'server.js',
      args: '--config /root/league/config.production.js',
      watch: '.',
      env_production: {
        NODE_ENV: 'production'
      },
      max_memory_restart: '2G'
    }
  ],

  deploy: {
    production: {
      user: 'root',
      host: '134.122.30.24',
      ref: 'origin/master',
      repo: 'https://github.com/mistakia/league.git',
      path: '/root/league',
      'pre-deploy': 'git pull',
      'pre-deploy-local': '',
      'post-deploy':
        'source /root/.bash_profile && /root/.yarn/bin/yarn install && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
}
