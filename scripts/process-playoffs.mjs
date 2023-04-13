import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants, Roster, calculatePoints } from '#common'
import { isMain, getLeague, getRoster } from '#utils'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('process-playoffs')
debug.enable('process-playoffs')

const processPlayoffs = async ({ lid, year }) => {
  const league = await getLeague({ lid })
  const playoffs = await db('playoffs').where({ lid, year })
  const weeks = [...new Set(playoffs.map((p) => p.week))]
  const gamelogs = await db('player_gamelogs')
    .select('player_gamelogs.*', 'nfl_games.week', 'nfl_games.year')
    .join('nfl_games', 'nfl_games.esbid', 'player_gamelogs.esbid')
    .where('nfl_games.year', year)
    .where('nfl_games.seas_type', 'REG')
    .whereIn('nfl_games.week', weeks)

  for (const item of playoffs) {
    const { tid, week, year } = item
    const rosterRow = await getRoster({ tid, week, year })
    const roster = new Roster({ roster: rosterRow, league })
    item.points = 0
    for (const { pid, pos } of roster.starters) {
      const gamelog = gamelogs.find((g) => g.week === week && g.pid === pid)
      if (!gamelog) {
        log(`WARN: gamelog not found for ${pid} for week ${week}`)
        continue
      }
      const points = calculatePoints({
        stats: gamelog,
        position: pos,
        league
      })
      item.points = points.total + item.points
    }
  }

  await db('playoffs').insert(playoffs).onConflict().merge()
  log(`updated ${playoffs.length} playoff results`)
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

    if (!year) {
      console.log('missing --year')
      return
    }

    await processPlayoffs({ lid, year })
  } catch (err) {
    error = err
    log(error)
  }

  await db('jobs').insert({
    type: constants.jobs.PROCESS_PLAYOFFS,
    succ: error ? 0 : 1,
    reason: error ? error.message : null,
    timestamp: Math.round(Date.now() / 1000)
  })

  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}

export default processPlayoffs
