const path = require('path')

module.exports = {
  ssl: true,
  key: path.resolve(__dirname, './key.pem'),
  cert: path.resolve(__dirname, './cert.pem'),
  port: 443,
  url: 'https://example.com',
  nominationTimer: 30000,
  bidTimer: 15000,
  pff: '', // cookies for pff
  nfl_api_url: '',
  ngs_api_url: '',
  mflUserAgent: '',
  sportradar_api: '',
  espn_api_v2_url: '',
  espn_api_v3_url: '',
  draftkings_api_v5_url: '',
  caesars_api_v3_url: '',
  fanduel_api_url: '',
  betmgm_api_url: '',
  prizepicks_api_url: '',
  discord_props_change_channel_webhook_url: '',
  discord_props_open_channel_webhook_url: '',
  email: {
    api: '', // sendgrid api
    admin: '',
    from: ''
  },
  clickSend: {
    auth: '',
    number: ''
  },
  jwt: {
    secret: 'xxxxx',
    algorithms: ['HS256'],
    credentialsRequired: false
  },
  mysql: {
    client: 'mysql2',
    connection: {
      host: 'localhost',
      user: 'root',
      password: 'xxxxx',
      database: 'league_production',
      decimalNumbers: true
    },
    pool: {
      min: 2,
      max: 10
    },
    migrations: {
      directory: path.resolve(__dirname, './db/migrations'),
      loadExtensions: ['.mjs'],
      tableName: 'league_migrations'
    },
    seeds: {
      directory: path.resolve(__dirname, './db/seeds/production')
    }
  }
}
