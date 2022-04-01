// eslint-disable-next-line
require = require('esm')(module /*, options*/)
const debug = require('debug')
const argv = require('yargs').argv

const db = require('../db')
const { constants, Roster, getExtensionAmount } = require('../common')
const { getLeague, getRoster, getPlayerExtensions } = require('../utils')

const log = debug('process-extensions')
debug.enable('process-extensions')

const getTransactionType = (tag) => {
  switch (tag) {
    case constants.tags.FRANCHISE:
      return constants.transactions.FRANCHISE_TAG
    case constants.tags.ROOKIE:
      return constants.transactions.ROOKIE_TAG
    case constants.tags.REGULAR:
      return constants.transactions.EXTENSION
  }
}

const createTransaction = async ({ player, tid, league }) => {
  if (player.tag === constants.tags.TRANSITION) {
    return null
  }

  const extensions = await getPlayerExtensions({
    lid: league.uid,
    player: player.player
  })
  const value = getExtensionAmount({
    extensions: extensions.length,
    tag: player.tag,
    pos: player.pos,
    league,
    value: player.value
  })
  return {
    userid: 0,
    tid,
    lid: league.uid,
    player: player.player,
    type: getTransactionType(player.tag),
    value,
    year: constants.season.year,
    timestamp: league.ext_date
  }
}

const run = async ({ lid }) => {
  const league = await getLeague(lid)
  const teams = await db('teams').where({ lid })
  await db('transactions')
    .where({
      userid: 0,
      lid,
      year: constants.season.year
    })
    .del()

  for (const team of teams) {
    const tid = team.uid
    const rosterRow = await getRoster({ tid })
    const roster = new Roster({ roster: rosterRow, league })
    const transactions = []
    const players = [...roster.active, ...roster.ir, ...roster.reserve]
    for (const player of players) {
      const transaction = await createTransaction({ player, tid, league })
      if (transaction) transactions.push(transaction)
    }

    if (transactions.length) {
      log(`creating ${transactions.length} transactions for teamId: ${tid}`)
      await db('transactions').insert(transactions)
    }
  }
}

module.exports = run

const main = async () => {
  let error
  try {
    const lid = argv.lid
    if (!lid) {
      console.log('missing --lid')
      return
    }
    await run({ lid })
  } catch (err) {
    error = err
    console.log(error)
  }

  await db('jobs').insert({
    type: constants.jobs.PROCESS_EXTENSIONS,
    succ: error ? 0 : 1,
    reason: error ? error.message : null,
    timestamp: Math.round(Date.now() / 1000)
  })

  process.exit()
}

if (!module.parent) {
  main()
}
