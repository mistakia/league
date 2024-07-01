import knex from '#db'

export async function mochaGlobalSetup() {
  await knex.seed.run()
}
