// eslint-disable-next-line
require = require('esm')(module /*, options*/)

const db = require('../db')
const { constants } = require('../common')

const run = async () => {
  const leagues = await db('leagues').where('hosted', 1)

  if (!constants.season.isRegularSeason) {
    return
  }

  const year = constants.season.year + 1
  for (const league of leagues) {
    const picks = await db('draft').where({ lid: league.uid, year }).limit(1)
    if (picks.length) continue

    const teams = await db('teams').where({ lid: league.uid })
    for (const team of teams) {
      for (let i = 1; i < 4; i++) {
        await db.raw(
          db('draft')
            .insert({
              tid: team.uid,
              otid: team.uid,
              lid: league.uid,
              round: i,
              year
            })
            .toString()
            .replace('insert', 'INSERT IGNORE')
        )
      }
    }
  }
}

module.exports = run

const main = async () => {
  let error
  try {
    await run()
  } catch (err) {
    error = err
    console.log(error)
  }

  await db('jobs').insert({
    type: constants.jobs.GENERATE_DRAFT_PICKS,
    succ: error ? 0 : 1,
    reason: error ? error.message : null,
    timestamp: Math.round(Date.now() / 1000)
  })

  process.exit()
}

if (!module.parent) {
  main()
}
