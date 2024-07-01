import pg from 'pg'
import Knex from 'knex'
import config from '#config'

pg.types.setTypeParser(pg.types.builtins.NUMERIC, Number)
pg.types.setTypeParser(pg.types.builtins.INT8, Number)

const postgres = Knex(config.postgres)
export default postgres
