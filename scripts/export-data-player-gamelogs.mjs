import debug from 'debug'
import fs from 'fs-extra'
import path, { dirname } from 'path'
import { fileURLToPath } from 'url'
// import yargs from 'yargs'
// import { hideBin } from 'yargs/helpers'

import db from '#db'
import { convertToCSV, constants } from '#common'
import { isMain } from '#utils'

const __dirname = dirname(fileURLToPath(import.meta.url))
const data_path = path.join(__dirname, '../data')

// const argv = yargs(hideBin(process.argv)).argv
const log = debug('export-data-player-gamelogs')
debug.enable('export-data-player-gamelogs')

const player_gamelog_fields = [
  'esbid',
  'pid',
  'opp',
  'tm',
  'pos',
  // 'off',
  // 'def',
  ...constants.fantasy_player_stats,
  ...constants.fantasy_kicker_stats,
  ...constants.fantasy_defense_stats
]

const export_data_player_gamelogs = async () => {
  const data = await db('player_gamelogs')

  const header = {}
  for (const field of player_gamelog_fields) {
    header[field] = field
  }

  const formatted_data = data.map((row) => {
    const result = {}
    for (const field of player_gamelog_fields) {
      result[field] = row[field] || 0
    }

    return result
  })
  const csv_data = [header, ...formatted_data]
  const csv_data_string = JSON.stringify(csv_data)
  const csv = convertToCSV(csv_data_string)

  const json_file_path = `${data_path}/player_gamelogs.json`
  const csv_file_path = `${data_path}/player_gamelogs.csv`

  await fs.writeJson(json_file_path, data, { spaces: 2 })
  log(`wrote json to ${json_file_path}`)

  await fs.writeFile(csv_file_path, csv)
  log(`wrote csv to ${csv_file_path}`)
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
