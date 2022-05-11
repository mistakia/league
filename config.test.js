const path = require('path')

module.exports = {
  mysql: {
    client: 'mysql2',
    connection: {
      host: '127.0.0.1',
      user: 'root',
      database: 'league_test',
      decimalNumbers: true,
      multipleStatements: true
    },
    migrations: {
      directory: path.resolve(__dirname, './db/migrations'),
      loadExtensions: ['.mjs'],
      tableName: 'league_migrations'
    },
    seeds: {
      directory: path.resolve(__dirname, './db/seeds/test'),
      loadExtensions: ['.mjs']
    }
  },
  ssl: false,
  key: null,
  cert: null,
  jwt: {
    secret: 'WajgVhpr4iCFjGq7rW'
  }
}
