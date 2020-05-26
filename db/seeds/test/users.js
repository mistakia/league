exports.seed = async function (knex, Promise) {
  await knex('users').del()

  return knex('users').insert({
    email: 'test@email.com',
    password: '$2b$10$OjtfwDYQF4K9CSQwRrQ4UOCWZpF.wSF.FFbux3rHAvWSu.IzeepFO'
  })
}
