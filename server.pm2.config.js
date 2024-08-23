module.exports = {
  apps: [
    {
      script: 'server.mjs',
      args: '--config /root/league/config.production.js',
      watch: '.',
      env_production: {
        NODE_ENV: 'production'
      },
      max_memory_restart: '3G',
      node_args: '--max-old-space-size=3072'
    }
  ],

  deploy: {
    production: {
      user: 'root',
      host: '38.242.199.45',
      ref: 'origin/master',
      repo: 'https://github.com/mistakia/league.git',
      path: '/root/league',
      'pre-deploy': 'git pull',
      'pre-deploy-local': '',
      'post-deploy':
        'source /root/.bash_profile && /root/.nvm/versions/node/v17.4.0/bin/yarn install && pm2 reload server.pm2.config.js --env production',
      'pre-setup': ''
    }
  }
}
