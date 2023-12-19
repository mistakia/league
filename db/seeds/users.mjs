import bcrypt from 'bcrypt'

export default async function (knex) {
  await knex('users').del()
  await knex.raw('ALTER TABLE users AUTO_INCREMENT = 1')
  const userCount = 12
  for (let i = 1; i <= userCount; i++) {
    const salt = await bcrypt.genSalt(10)
    const password = await bcrypt.hash(`password${i}`, salt)
    await knex('users').insert({
      email: `user${i}@email.com`,
      username: `user${i}`,
      password
    })
  }
}
