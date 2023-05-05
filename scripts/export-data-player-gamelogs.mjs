import debug from 'debug'
import fs from 'fs-extra'
import path, { dirname } from 'path'
import { fileURLToPath } from 'url'
// import yargs from 'yargs'
// import { hideBin } from 'yargs/helpers'

import db from '#db'
import { convertToCSV } from '#common'
import { isMain } from '#utils'

const __dirname = dirname(fileURLToPath(import.meta.url))
const data_path = path.join(__dirname, '../data')

// const argv = yargs(hideBin(process.argv)).argv
const log = debug('export-data-player-gamelogs')
debug.enable('export-data-player-gamelogs')

const export_data_player_gamelogs = async () => {
  const data = await db('player_gamelogs')
    .select('player_gamelogs.*', 'nfl_games.year')
    .join('nfl_games', 'player_gamelogs.esbid', 'nfl_games.esbid')
    .orderBy('esbid', 'asc')
    .orderBy('pid', 'asc')

  const header = {}
  for (const field of Object.keys(data[0])) {
    header[field] = field
  }

  const gamelogs_by_year = {}
  for (const item of data) {
    const { year, ...gamelog } = item
    if (!gamelogs_by_year[year]) {
      gamelogs_by_year[year] = []
    }

    gamelogs_by_year[year].push(gamelog)
  }

  for (const year of Object.keys(gamelogs_by_year)) {
    const year_data = gamelogs_by_year[year]
    const year_json_file_path = `${data_path}/player_gamelogs_${year}.json`
    const year_csv_file_path = `${data_path}/player_gamelogs_${year}.csv`

    const year_csv_data = [header, ...year_data]
    const year_csv_data_string = JSON.stringify(year_csv_data)
    const year_csv = convertToCSV(year_csv_data_string)

    await fs.writeJson(year_json_file_path, year_data, { spaces: 2 })
    log(`wrote json to ${year_json_file_path}`)

    await fs.writeFile(year_csv_file_path, year_csv)
    log(`wrote csv to ${year_csv_file_path}`)
  }
}

const main = async () => {
  let error
  try {
    await export_data_player_gamelogs()
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

export default export_data_player_gamelogs
