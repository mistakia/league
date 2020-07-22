const path = require('path')

module.exports = {
  ssl: false,
  key: null,
  cert: null,
  url: 'http://localhost:1212',
  nominationTimer: 30000,
  bidTimer: 15000,
  pff: '', // cookies for pff
  jwt: {
    secret: 'WajgVhpr4iCFjGq7rW',
    credentialsRequired: false
  },
  mysql: {
    client: 'mysql',
    connection: {
      host: 'localhost',
      user: 'root',
      database: 'league_development'
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
      directory: path.resolve(__dirname, './db/seeds/development')
    }
  }
}
