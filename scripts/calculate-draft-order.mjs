import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants } from '#common'
import { isMain } from '#utils'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('calculate-draft-order')
debug.enable('calculate-draft-order')

const calculateDraftOrder = async ({ lid, year = constants.season.year }) => {
  const previousYear = year - 1
  const teamStats = await db('team_stats').where({ lid, year: previousYear })
  const playoffs = await db('playoffs').where({ lid, year: previousYear })

  const playoff_tids = [...new Set(playoffs.map((p) => p.tid))]

  let draft_order = teamStats
    .filter((t) => !playoff_tids.includes(t.tid))
    .sort((a, b) => a.doi - b.doi)
    .map(({ tid, doi }) => ({ tid, doi }))

  const wildcard_teams = playoffs
    .filter((p) => p.uid === 1)
    .map(({ tid, points }) => ({ tid, points }))
    .sort((a, b) => a.points - b.points)

  draft_order.push(wildcard_teams[0])
  draft_order.push(wildcard_teams[1])

  let championship_teams = []
  const championship_tids = [
    ...new Set(playoffs.filter((p) => p.uid === 3).map((p) => p.tid))
  ]
  for (const tid of championship_tids) {
    const round_one = playoffs.find((p) => p.uid === 2 && p.tid === tid)
    const round_two = playoffs.find((p) => p.uid === 3 && p.tid === tid)
    championship_teams.push({
      tid,
      points: round_one.points + round_two.points
    })
  }

  championship_teams = championship_teams.sort((a, b) => a.points - b.points)
  draft_order = draft_order.concat(championship_teams)

  log(draft_order)
  for (const [index, team] of draft_order.entries()) {
    await db('teams')
      .update({
        do: index + 1
      })
      .where({ uid: team.tid })
  }

  log(`updated draft order for ${year}`)
}

const main = async () => {
  let error
  try {
    const lid = argv.lid
    const year = argv.year
    if (!lid) {
      console.log('missing --lid')
      return
    }

    await calculateDraftOrder({ lid, year })
  } catch (err) {
    error = err
    log(error)
  }

  /* await db('jobs').insert({
   *   type: constants.jobs.EXAMPLE,
   *   succ: error ? 0 : 1,
   *   reason: error ? error.message : null,
   *   timestamp: Math.round(Date.now() / 1000)
   * })
   */
  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}

export default calculateDraftOrder
