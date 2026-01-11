module.exports = {
  apps: [
    {
      script: 'server.mjs',
      watch: '.',
      env_production: {
        NODE_ENV: 'production',
        CONFIG_ENCRYPTION_KEY: process.env.CONFIG_ENCRYPTION_KEY
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
      repo: 'git@github.com:mistakia/league.git',
      path: '/root/league',
      ssh_options: 'ForwardAgent=yes',
      'pre-deploy': 'git pull',
      'pre-deploy-local': '',
      'post-deploy': [
        'source /root/.bash_profile',
        'export PATH=/root/.nvm/versions/node/current/bin:/usr/local/bin:$PATH',
        'git submodule update --init private',
        'yarn install',
        'pm2 reload server.pm2.config.js --env production'
      ].join(' && '),
      'pre-setup': ''
    }
  }
}
