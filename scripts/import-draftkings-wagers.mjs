import debug from 'debug'
import yargs from 'yargs'
import dayjs from 'dayjs'
import fs from 'fs-extra'
import path, { dirname } from 'path'
import { fileURLToPath } from 'url'
import { hideBin } from 'yargs/helpers'

// import db from '#db'
// import { constants } from '#libs-shared'
import { isMain, draftkings } from '#libs-server'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import-draftkings-wagers')
debug.enable('import-draftkings-wagers,draft-kings')

const __dirname = dirname(fileURLToPath(import.meta.url))
const data_path = path.join(__dirname, '../tmp')

const import_draftkings_wagers = async ({
  authorization,
  placed_after,
  placed_before
} = {}) => {
  if (!placed_after) {
    placed_after = dayjs().subtract(1, 'week')
  }

  log({
    placed_after: placed_after.format()
  })

  const wagers = await draftkings.get_all_wagers({
    authorization,
    placed_after,
    placed_before
  })
  log(`loaded ${wagers.length} wagers`)

  await fs.ensureDir(data_path)
  const json_file_path = `${data_path}/draftkings_wagers_${placed_after.format(
    'YYYY'
  )}_${placed_after.format('MM')}_${placed_after.format('DD')}.json`
  await fs.writeJson(json_file_path, wagers, { spaces: 2 })
  log(`wrote json to ${json_file_path}`)
}

const main = async () => {
  let error
  try {
    const auth = argv.auth

    const placed_after = argv.placed_after
      ? dayjs(argv.placed_after, 'YYYY-MM-DD')
      : null
    const placed_before = argv.placed_before
      ? dayjs(argv.placed_before, 'YYYY-MM-DD')
      : null
    await import_draftkings_wagers({
      authorization: auth,
      placed_after,
      placed_before
    })
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

export default import_draftkings_wagers
