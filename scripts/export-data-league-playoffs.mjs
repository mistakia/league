import debug from 'debug'
import fs from 'fs-extra'
import path, { dirname } from 'path'
import { fileURLToPath } from 'url'
// import yargs from 'yargs'
// import { hideBin } from 'yargs/helpers'

import db from '#db'
import { convert_to_csv } from '#libs-shared'
import { is_main } from '#libs-server'
// import { job_types } from '#libs-shared/job-constants.mjs'

// const argv = yargs(hideBin(process.argv)).argv
const log = debug('export_league_playoffs')
debug.enable('export_league_playoffs')

const __dirname = dirname(fileURLToPath(import.meta.url))
const data_path = path.join(__dirname, '../data')

const export_league_playoffs = async () => {
  const data = await db('playoffs')
    .select(
      'uid',
      'tid',
      'lid',
      'year',
      'week',
      'points',
      'points_manual',
      'projection'
    )
    .orderBy('year', 'asc')
    .orderBy('uid', 'asc')
    .orderBy('tid', 'asc')

  const header = {}
  for (const field of Object.keys(data[0])) {
    header[field] = field
  }
  const csv_data = [header, ...data]
  const csv_data_string = JSON.stringify(csv_data)
  const csv = convert_to_csv(csv_data_string)

  await fs.ensureDir(`${data_path}/league`)
  const json_file_path = `${data_path}/league/playoffs.json`
  const csv_file_path = `${data_path}/league/playoffs.csv`

  await fs.writeJson(json_file_path, data, { spaces: 2 })
  log(`wrote json to ${json_file_path}`)

  await fs.writeFile(csv_file_path, csv)
  log(`wrote csv to ${csv_file_path}`)
}

const main = async () => {
  let error
  try {
    await export_league_playoffs()
  } catch (err) {
    error = err
    log(error)
  }

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default export_league_playoffs
