import dayjs from 'dayjs'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { report_job } from '#libs-server'

// Shared CLI runner for composite-market-value scripts. Parses the four
// common options (--start-date, --end-date, --all-history, --rebuild),
// resolves start/end against KTC date range when --all-history, calls the
// supplied delegate inside a report_job wrapper, and exits.

export const run_cmv_script = async ({ job_type, fn, log }) => {
  let error
  try {
    const argv = yargs(hideBin(process.argv))
      .option('start-date', { type: 'string' })
      .option('end-date', { type: 'string' })
      .option('all-history', { type: 'boolean', default: false })
      .option('rebuild', { type: 'boolean', default: false })
      .parse()

    let start_date = argv['start-date']
    const end_date = argv['end-date'] || dayjs().format('YYYY-MM-DD')

    if (argv['all-history']) {
      const min = await db('keeptradecut_rankings').min('d as min').first()
      start_date = dayjs.unix(min.min).format('YYYY-MM-DD')
    } else if (!start_date) {
      start_date = dayjs().subtract(1, 'day').format('YYYY-MM-DD')
    }

    await fn({ start_date, end_date, rebuild: argv.rebuild })
  } catch (err) {
    error = err
    log(error)
  }
  await report_job({ job_type, error })
  process.exit()
}
