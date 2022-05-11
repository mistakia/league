import debug from 'debug'

import db from '#db'
import { constants } from '#common'
import { isMain } from '#utils'

const log = debug('generate-draft-picks')

const run = async ({ year = constants.season.year + 1 } = {}) => {
  const leagues = await db('leagues').where('hosted', 1)

  /* if (!constants.season.isRegularSeason) {
   *   return
   * }
   */

  for (const league of leagues) {
    const picks = await db('draft').where({ lid: league.uid, year }).limit(1)
    if (picks.length) continue

    const teams = await db('teams').where({ lid: league.uid })
    for (const team of teams) {
      for (let i = 1; i < 4; i++) {
        const rows = await db('draft').where({
          otid: team.uid,
          round: i,
          lid: league.uid,
          year
        })

        if (rows.length) {
          log(`picks exist for team ${team.uid} in round ${i}, year ${year}`)
          continue
        }

        await db('draft').insert({
          tid: team.uid,
          otid: team.uid,
          lid: league.uid,
          round: i,
          year
        })
      }
    }

    log(`generated picks for ${teams.length} teams`)
  }
}

const main = async () => {
  debug.enable('generate-draft-picks')
  let error
  try {
    const year = argv.year
    await run({ year })
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

if (isMain()) {
  main()
}

export default run
