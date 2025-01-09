import * as chai from 'chai'

import db from '#db'

const expect = chai.expect

export default async function ({ leagueId, type, value, pid, teamId, userId }) {
  const transactions = await db('transactions')
    .orderBy('timestamp', 'desc')
    .orderBy('uid', 'desc')
    .limit(1)
  const transaction = transactions[0]

  expect(transaction.lid).to.equal(leagueId)
  expect(transaction.type).to.equal(type)
  expect(transaction.value).to.equal(value)
  expect(transaction.pid).to.equal(pid)
  expect(transaction.tid).to.equal(teamId)
  expect(transaction.userid).to.equal(userId)
}
