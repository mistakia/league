import knex from '#db'

export async function mochaGlobalSetup() {
  await knex.migrate.forceFreeMigrationsLock()
  await knex.migrate.rollback()
  await knex.migrate.latest()
  await knex.seed.run()
}
