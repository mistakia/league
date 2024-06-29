import Knex from 'knex'
import config from '#config'

const postgres = Knex(config.postgres)
export default postgres
