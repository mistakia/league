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
  clickSend: {
    auth: '',
    number: ''
  },
  jwt: {
    secret: 'xxxxx',
    credentialsRequired: false
  },
  mysql: {
    client: 'mysql',
    connection: {
      host: 'localhost',
      user: 'root',
      password: 'xxxxx',
      database: 'league_production'
    },
    pool: {
      min: 2,
      max: 10
    },
    migrations: {
      directory: path.resolve(__dirname, './db/migrations'),
      tableName: 'league_migrations'
    },
    seeds: {
      directory: path.resolve(__dirname, './db/seeds/production')
    }
  }
}
