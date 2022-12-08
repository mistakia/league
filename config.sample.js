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

  discord_props_open_alts_channel_webhook_url: '',
  discord_props_open_sunday_leaders_channel_webhook_url: '',
  discord_props_open_game_leaders_channel_webhook_url: '',
  discord_props_open_over_under_channel_webhook_url: '',

  discord_props_open_passing_yards_channel_webhook_url: '',
  discord_props_open_receiving_yards_channel_webhook_url: '',
  discord_props_open_rushing_yards_channel_webhook_url: '',
  discord_props_open_passing_completions_channel_webhook_url: '',
  discord_props_open_passing_touchdowns_channel_webhook_url: '',
  discord_props_open_receptions_channel_webhook_url: '',
  discord_props_open_passing_interceptions_channel_webhook_url: '',
  discord_props_open_rushing_attempts_channel_webhook_url: '',
  discord_props_open_scrimmage_yards_channel_webhook_url: '',
  discord_props_open_receiving_touchdowns_channel_webhook_url: '',
  discord_props_open_rushing_touchdowns_channel_webhook_url: '',
  discord_props_open_passing_attempts_channel_webhook_url: '',
  discord_props_open_longest_completion_channel_webhook_url: '',
  discord_props_open_longest_reception_channel_webhook_url: '',
  discord_props_open_longest_rush_channel_webhook_url: '',
  discord_props_open_tackles_assists_channel_webhook_url: '',
  discord_props_open_rushing_receiving_touchdowns_channel_webhook_url: '',

  discord_props_open_prizepicks_channel_webhook_url: '',

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
