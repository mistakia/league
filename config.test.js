const path = require('path')

module.exports = {
  mysql: {
    client: 'mysql',
    connection: {
      host: 'localhost',
      user: 'root',
      database: 'league_test',
      multipleStatements: true
    },
    migrations: {
      directory: path.resolve(__dirname, './db/migrations'),
      tableName: 'league_migrations'
    },
    seeds: {
      directory: path.resolve(__dirname, './db/seeds/test')
    }
  },
  ssl: false,
  key: null,
  cert: null,
  jwt: {
    secret: 'WajgVhpr4iCFjGq7rW'
  }
}
