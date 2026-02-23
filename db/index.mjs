import pg from 'pg'
import Knex from 'knex'
import config from '#config'

pg.types.setTypeParser(pg.types.builtins.NUMERIC, Number)
pg.types.setTypeParser(pg.types.builtins.INT8, Number)

if (process.env.LEAGUE_DB_HOST) {
  config.postgres.connection.host = process.env.LEAGUE_DB_HOST
}
if (process.env.LEAGUE_DB_PORT) {
  config.postgres.connection.port = process.env.LEAGUE_DB_PORT
}

const postgres = Knex(config.postgres)
export default postgres
