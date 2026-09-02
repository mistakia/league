import debug from 'debug'
import fs from 'node:fs/promises'
import path, { dirname } from 'path'
import { fileURLToPath } from 'url'
// import yargs from 'yargs'
// import { hideBin } from 'yargs/helpers'

import db from '#db'
import { convert_to_csv } from '#libs-shared'
import { is_main } from '#libs-server'
import { enable_debug_namespaces } from '#libs-shared/enable-debug-namespaces.mjs'
// import { job_types } from '#libs-shared/job-constants.mjs'

// const argv = yargs(hideBin(process.argv)).argv
const log = debug('export_league_league_team_seasonlogs')
enable_debug_namespaces('export_league_league_team_seasonlogs')

const __dirname = dirname(fileURLToPath(import.meta.url))
const data_path = path.join(__dirname, '../data')

const export_league_league_team_seasonlogs = async () => {
  const data = await db('league_team_seasonlogs')
    .orderBy('season_year', 'asc')
    .orderBy('lid', 'asc')
    .orderBy('tid', 'asc')

  const csv = convert_to_csv({ rows: data })

  const json_file_path = `${data_path}/league/league_team_seasonlogs.json`
  const csv_file_path = `${data_path}/league/league_team_seasonlogs.csv`

  await fs.mkdir(`${data_path}/league`, { recursive: true })
  await fs.writeFile(json_file_path, JSON.stringify(data, null, 2))
  log(`wrote json to ${json_file_path}`)

  await fs.writeFile(csv_file_path, csv)
  log(`wrote csv to ${csv_file_path}`)
}

const main = async () => {
  let error
  try {
    await export_league_league_team_seasonlogs()
  } catch (err) {
    error = err
    log(error)
  }

  process.exit(error ? 1 : 0)
}

if (is_main(import.meta.url)) {
  main()
}

export default export_league_league_team_seasonlogs
