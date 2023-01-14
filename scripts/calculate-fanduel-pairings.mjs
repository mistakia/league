import debug from 'debug'
import dayjs from 'dayjs'
import fs from 'fs-extra'
// import * as oddslib from 'oddslib'
import path, { dirname } from 'path'
import { fileURLToPath } from 'url'
// import { Table } from 'console-table-printer'
// import yargs from 'yargs'
// import { hideBin } from 'yargs/helpers'

// import db from '#db'
// import { constants } from '#common'
import { isMain } from '#utils'

// const argv = yargs(hideBin(process.argv)).argv
const log = debug('analyze-fanduel-wagers')
debug.enable('analyze-fanduel-wagers')

const __dirname = dirname(fileURLToPath(import.meta.url))
const data_path = path.join(__dirname, '../tmp')

const analyze_fanduel_wagers = async () => {
  const json_file_path = `${data_path}/fanduel_wagers.json`
  const wagers = await fs.readJson(json_file_path)

  const placed_after = dayjs('2022-12-22', 'YYYY-MM-DD')

  const filtered = wagers.filter((wager) => {
    if (wager.legs.length < 2) {
      return false
    }

    return dayjs(wager.placedDate).isAfter(placed_after)
  })

  log(filtered.length)

  const pairings_index = []

  /* const does_paring_exist = ({ part, position }) => {
   *   for (const item of pairings_index) {
   *     if (item[position].selectionName === part.selectionName) {
   *       return true
   *     }
   *   }

   *   return false
   * }
   */
  for (const wager of filtered) {
    const item = wager.legs.map((leg) => leg.parts[0].selectionName).join(' / ')
    pairings_index.push(item)
  }

  console.dir(pairings_index, { maxArrayLength: null })
}

const main = async () => {
  let error
  try {
    await analyze_fanduel_wagers()
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

export default analyze_fanduel_wagers
