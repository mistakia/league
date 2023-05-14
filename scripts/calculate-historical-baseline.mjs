import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants } from '#common'
import { isMain, getLeague, get_league_format } from '#utils'
import calculateVOR from './calculate-vor.mjs'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('calculate-historical-baseline')
debug.enable('calculate-historical-baseline')

const calculateHistoricalBaseline = async ({
  league_format_hash,
  save = false
}) => {
  const league_format = await get_league_format({ league_format_hash })
  const years = 2
  let year = constants.season.year - years

  const bTotals = {}
  constants.positions.forEach((p) => (bTotals[p] = 0))
  let totalWeeks = 0
  for (; year < constants.season.year; year++) {
    const { baselineTotals, weeks } = await calculateVOR({
      year,
      league: league_format
    })
    for (const [position, total] of Object.entries(baselineTotals)) {
      bTotals[position] += total
    }
    totalWeeks += weeks
  }

  log(bTotals)
  const update = {}
  for (const position of constants.positions) {
    const totalPoints = bTotals[position]
    const avg = totalPoints / totalWeeks
    update[`b_${position}`] = Math.round(avg * 10) / 10
    log(`${position} baseline per week: ${avg.toFixed(2)}`)
  }

  if (save) {
    log(update)
    await db('league_formats').update(update).where({ league_format_hash })
  }
}

const main = async () => {
  let error
  try {
    if (argv.lid) {
      const league = await getLeague({ lid: argv.lid })
      if (!league) {
        throw new Error(`League ${argv.lid} not found`)
      }
      const { league_format_hash } = league
      await calculateHistoricalBaseline({ league_format_hash, save: argv.save })
    } else {
      const league_formats = await db('league_formats')
      log(`calculating baseline for ${league_formats.length} league formats`)
      for (const league_format of league_formats) {
        const { league_format_hash } = league_format
        await calculateHistoricalBaseline({
          league_format_hash,
          save: argv.save
        })
      }
    }
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

export default calculateHistoricalBaseline
