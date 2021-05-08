// eslint-disable-next-line
require = require('esm')(module /*, options*/)
const debug = require('debug')

const db = require('../db')
const { constants, groupBy } = require('../common')

const log = debug('calculate:franchise-tags')
debug.enable('calculate:franchise-tags')

const average = (array) => array.reduce((a, b) => a + b) / array.length

const run = async () => {
  const seasons = await db('seasons').where('year', constants.season.year)
  for (const { lid, year } of seasons) {
    const rosters = await db('rosters_players')
      .select(
        'rosters_players.*',
        'transactions.type',
        'transactions.value',
        'transactions.timestamp',
        'transactions.year'
      )
      .join('rosters', 'rosters_players.rid', '=', 'rosters.uid')
      .leftJoin('transactions', function () {
        this.on(
          'transactions.uid',
          '=',
          db.raw(
            '(select max(uid) from transactions where transactions.tid = rosters.tid and transactions.player = rosters_players.player)'
          )
        )
      })
      .where('rosters.lid', lid)
      .where('rosters.week', 0)
      .where('rosters.year', year - 1)

    const grouped = groupBy(rosters, 'pos')
    const key = {
      QB: 10,
      RB: 10,
      WR: 10,
      TE: 5
    }

    const update = {}
    for (const pos in key) {
      const players = grouped[pos]
      const sorted = players.sort((a, b) => b.value - a.value)
      const top = sorted.slice(0, key[pos])
      const values = top.map((p) => p.value)
      const avg = average(values)
      update[`f${pos.toLowerCase()}`] = Math.round(avg)
    }

    log(`Updating lid ${lid} with:`, update)
    await db('seasons').update(update).where({ lid, year })
  }
}

module.exports = run

// TODO - accept leagueId
const main = async () => {
  let error
  try {
    await run()
  } catch (err) {
    error = err
    console.log(error)
  }

  await db('jobs').insert({
    type: constants.jobs.CALCULATE_FRANCHISE_TAGS,
    succ: error ? 0 : 1,
    reason: error ? error.message : null,
    timestamp: Math.round(Date.now() / 1000)
  })

  process.exit()
}

if (!module.parent) {
  main()
}
