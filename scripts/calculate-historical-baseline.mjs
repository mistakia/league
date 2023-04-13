import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { constants } from '#common'
import { isMain, getLeague } from '#utils'
import calculateVOR from './calculate-vor.mjs'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('calculate-historical-baseline')
debug.enable('calculate-historical-baseline')

const calculateHistoricalBaseline = async ({ lid, save = false }) => {
  const league = await getLeague({ lid })
  const years = 2
  let year = constants.season.year - years

  const bTotals = {}
  constants.positions.forEach((p) => (bTotals[p] = 0))
  let totalWeeks = 0
  for (; year < constants.season.year; year++) {
    const { baselineTotals, weeks } = await calculateVOR({ year, league })
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
    await db('leagues').update(update).where({ uid: lid })
  }
}

const main = async () => {
  let error
  try {
    const lid = argv.lid
    if (typeof lid === 'undefined') {
      console.log('missing --lid')
      return
    }

    await calculateHistoricalBaseline({ lid, save: argv.save })
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
