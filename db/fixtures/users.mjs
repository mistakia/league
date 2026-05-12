import bcrypt from 'bcrypt'

export default async function (knex) {
  await knex('users').del()
  await knex.raw('ALTER SEQUENCE users_id_seq RESTART WITH 1')
  const user_count = 12
  for (let i = 1; i <= user_count; i++) {
    const salt = await bcrypt.genSalt(10)
    const password = await bcrypt.hash(`password${i}`, salt)
    await knex('users').insert({
      email: `user${i}@email.com`,
      username: `user${i}`,
      password
    })
  }
}
