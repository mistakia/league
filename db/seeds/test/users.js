exports.seed = function(knex, Promise) {
  return knex('users').del() // Deletes ALL existing entries
    .then(function() { // Inserts seed entries one by one in series
      return knex('users').insert({
        email: 'test@email.com',
        password: '$2b$10$OjtfwDYQF4K9CSQwRrQ4UOCWZpF.wSF.FFbux3rHAvWSu.IzeepFO'
      })
    })
}
