import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants, groupBy } from '#common'
import { isMain } from '#utils'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('calculate:franchise-tags')
debug.enable('calculate:franchise-tags')

const average = (array) => array.reduce((a, b) => a + b) / array.length

const run = async ({ year = constants.season.year }) => {
  const seasons = await db('seasons')
    .select('seasons.*')
    .join('leagues', 'leagues.uid', '=', 'seasons.lid')
    .where('leagues.hosted', 1)
    .where('year', year)

  for (const { lid, year } of seasons) {
    log(`Calculating franchise tags for lid ${lid} in ${year}`)
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
            '(select max(uid) from transactions where transactions.tid = rosters.tid and transactions.pid = rosters_players.pid)'
          )
        )
      })
      .where('rosters.lid', lid)
      .where('rosters.week', 0)
      .where('rosters.year', year - 1)

    if (!rosters.length) {
      log(`Missing roster, skipping lid ${lid}`)
      continue
    }

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
      if (!players) {
        continue
      }

      const sorted = players.sort((a, b) => b.value - a.value)
      const top = sorted.slice(0, key[pos])
      const values = top.map((p) => p.value)
      const avg = average(values)
      update[`f${pos.toLowerCase()}`] = Math.round(avg)
    }

    if (argv.dry) {
      log(update)
      continue
    }

    log(`Updating lid ${lid} for ${constants.season.year} with:`, update)
    await db('seasons').update(update).where({ lid, year })
  }
}

export default run

// TODO - accept leagueId
const main = async () => {
  let error
  try {
    await run({ year: argv.year })
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

if (isMain(import.meta.url)) {
  main()
}
