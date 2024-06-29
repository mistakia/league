module.exports = {
  postgres: {
    client: 'pg',
    connection: {
      host: '127.0.0.1',
      user: 'league_test',
      database: 'league_test',
      password: 'league_test',
      port: 5432,
      decimalNumbers: true,
      multipleStatements: true
    }
  },
  ssl: false,
  key: null,
  cert: null,
  jwt: {
    secret: 'WajgVhpr4iCFjGq7rW',
    algorithms: ['HS256']
  }
}
