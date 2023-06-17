import debug from 'debug'
import fs from 'fs-extra'
import path, { dirname } from 'path'
import { fileURLToPath } from 'url'
// import yargs from 'yargs'
// import { hideBin } from 'yargs/helpers'

import db from '#db'
import { convertToCSV } from '#libs-shared'
import { isMain } from '#libs-server'

// const argv = yargs(hideBin(process.argv)).argv
const log = debug('export_league_team_stats')
debug.enable('export_league_team_stats')

const __dirname = dirname(fileURLToPath(import.meta.url))
const data_path = path.join(__dirname, '../data')

const export_league_team_stats = async () => {
  const data = await db('team_stats')
    .orderBy('year', 'asc')
    .orderBy('lid', 'asc')
    .orderBy('tid', 'asc')

  const header = {}
  for (const field of Object.keys(data[0])) {
    header[field] = field
  }
  const csv_data = [header, ...data]
  const csv_data_string = JSON.stringify(csv_data)
  const csv = convertToCSV(csv_data_string)

  const json_file_path = `${data_path}/league/team_stats.json`
  const csv_file_path = `${data_path}/league/team_stats.csv`

  await fs.ensureDir(`${data_path}/league`)
  await fs.writeJson(json_file_path, data, { spaces: 2 })
  log(`wrote json to ${json_file_path}`)

  await fs.writeFile(csv_file_path, csv)
  log(`wrote csv to ${csv_file_path}`)
}

const main = async () => {
  let error
  try {
    await export_league_team_stats()
  } catch (err) {
    error = err
    log(error)
  }

  // await db('jobs').insert({
  //   type: constants.jobs.EXAMPLE,
  //   succ: error ? 0 : 1,
  //   reason: error ? error.message : null,
  //   timestamp: Math.round(Date.now() / 1000)
  // })

  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}

export default export_league_team_stats
