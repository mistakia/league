import debug from 'debug'
import fs from 'fs-extra'
import path, { dirname } from 'path'
import { fileURLToPath } from 'url'
// import yargs from 'yargs'
// import { hideBin } from 'yargs/helpers'

import db from '#db'
import { convertToCSV } from '#libs-shared'
import { isMain } from '#libs-server'

const __dirname = dirname(fileURLToPath(import.meta.url))
const data_path = path.join(__dirname, '../data')

// const argv = yargs(hideBin(process.argv)).argv
const log = debug('export-data-nfl-games')
debug.enable('export-data-nfl-games')

const export_data_nfl_games = async () => {
  const data = await db('nfl_games').orderBy('esbid', 'asc')

  const header = {}
  for (const field of Object.keys(data[0])) {
    header[field] = field
  }
  const csv_data = [header, ...data]
  const csv_data_string = JSON.stringify(csv_data)
  const csv = convertToCSV(csv_data_string)

  const json_file_path = `${data_path}/nfl/games.json`
  const csv_file_path = `${data_path}/nfl/games.csv`

  await fs.writeJson(json_file_path, data, { spaces: 2 })
  log(`wrote json to ${json_file_path}`)

  await fs.writeFile(csv_file_path, csv)
  log(`wrote csv to ${csv_file_path}`)
}

const main = async () => {
  let error
  try {
    await export_data_nfl_games()
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

export default export_data_nfl_games
