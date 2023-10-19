const path = require('path')

module.exports = {
  user_agent: '',
  ssl: true,
  key: path.resolve(__dirname, './key.pem'),
  cert: path.resolve(__dirname, './cert.pem'),
  port: 443,
  url: 'https://example.com',
  nominationTimer: 30000,
  bidTimer: 15000,
  pro_football_reference_url: '',
  pff: '', // cookies for pff
  nfl_api_url: '',
  nfl_combine_profiles_url: '',
  ngs_api_url: '',
  mflUserAgent: '',
  sportradar_api: '',
  espn_api_v2_url: '',
  espn_api_v3_url: '',
  draftkings_api_v5_url: '',
  draftkings_api_v6_url: '',
  caesars_api_v3_url: '',
  fanduel_api_url: '',
  fanduel_api_headers: {},
  betmgm_api_url: '',
  prizepicks_api_url: '',
  gambet_api_url: '',
  betrivers_api_url: '',
  betrivers_market_groups_api_url: '',

  league_api_auth_token: '', // used for cache

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
  discord_props_open_rushing_receiving_yards_channel_webhook_url: '',
  discord_props_open_receiving_touchdowns_channel_webhook_url: '',
  discord_props_open_rushing_touchdowns_channel_webhook_url: '',
  discord_props_open_passing_attempts_channel_webhook_url: '',
  discord_props_open_longest_completion_channel_webhook_url: '',
  discord_props_open_longest_reception_channel_webhook_url: '',
  discord_props_open_longest_rush_channel_webhook_url: '',
  discord_props_open_tackles_assists_channel_webhook_url: '',
  discord_props_open_rushing_receiving_touchdowns_channel_webhook_url: '',

  discord_props_open_prizepicks_channel_webhook_url: '',

  discord_props_market_new_channel_webhook_url: '',
  discord_props_market_update_channel_webhook_url: '',

  filter_prop_pairings_options: {
    market_odds_max_threshold: 1,
    historical_rate_min_threshold: 1,
    opponent_allowed_rate_min_threshold: 1,
    joint_historical_rate_min_threshold: 1,
    prop_hits_min_threshold: 1,
    highest_payout_min_threshold: 100,
    lowest_payout_min_threshold: 100,
    edge_min_threshold: 0,
    total_games_min_threshold: 3,
    exclude_players: [],
    include_players: [],
    include_teams: [],
    exclude_props: [],
    include_props: [],
    exclude_nfl_team: [],
    opponent_allowed_py_min: null,
    opponent_allowed_ry_min: null,
    opponent_allowed_recy_min: null,
    opponent_allowed_pc_min: null,
    opponent_allowed_tdp_min: null,
    opponent_allowed_rec_min: null,
    opponent_allowed_ints_min: null,
    opponent_allowed_ra_min: null,
    opponent_allowed_tdrec_min: null,
    opponent_allowed_tdr_min: null,
    opponent_allowed_pa_min: null
  },

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
