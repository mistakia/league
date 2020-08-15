const chai = require('chai')

const db = require('../../db')

const expect = chai.expect

module.exports = async ({ leagueId, type, value, year, player, teamId, userId }) => {
  const transactions = await db('transactions')
    .orderBy('timestamp', 'desc')
    .orderBy('uid', 'desc')
    .limit(1)
  const transaction = transactions[0]

  expect(transaction.lid).to.equal(leagueId)
  expect(transaction.type).to.equal(type)
  expect(transaction.value).to.equal(value)
  expect(transaction.player).to.equal(player)
  expect(transaction.tid).to.equal(teamId)
  expect(transaction.userid).to.equal(userId)
}
