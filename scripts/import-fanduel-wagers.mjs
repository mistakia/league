import debug from 'debug'
import yargs from 'yargs'
import dayjs from 'dayjs'
import fs from 'fs-extra'
import path, { dirname } from 'path'
import { fileURLToPath } from 'url'
import { hideBin } from 'yargs/helpers'

// import db from '#db'
// import { constants } from '#libs-shared'
import { isMain, fanduel } from '#libs-server'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import-fanduel-wagers')
debug.enable('import-fanduel-wagers,fanduel')

const __dirname = dirname(fileURLToPath(import.meta.url))
const data_path = path.join(__dirname, '../tmp')

const import_fanduel_wagers = async ({
  authorization,
  is_settled = false,
  fanduel_state = 'va',
  placed_after,
  placed_before
} = {}) => {
  if (!placed_after) {
    placed_after = dayjs().subtract(1, 'week')
  }

  log({
    is_settled,
    placed_after: placed_after.format(),
    placed_before: placed_before ? placed_before.format() : null,
    fanduel_state
  })

  const wagers = await fanduel.get_all_wagers({
    fanduel_state,
    is_settled,
    authorization,
    placed_after,
    placed_before
  })
  log(`loaded ${wagers.length} wagers`)

  await fs.ensureDir(data_path)
  const json_file_path = `${data_path}/fanduel_wagers_${fanduel_state}_${placed_after.format(
    'YYYY'
  )}_${placed_after.format('MM')}_${placed_after.format('DD')}_${
    placed_before ? placed_before.format('YYYY_MM_DD') : 'present'
  }.json`
  await fs.writeJson(json_file_path, wagers, { spaces: 2 })
  log(`wrote json to ${json_file_path}`)
}

const main = async () => {
  let error
  try {
    const auth = argv.auth
    const fanduel_state = argv.state
    const is_settled = argv.is_settled === 'true' || argv.is_settled === true

    const placed_after = argv.placed_after
      ? dayjs(argv.placed_after, 'YYYY-MM-DD')
      : null
    const placed_before = argv.placed_before
      ? dayjs(argv.placed_before, 'YYYY-MM-DD')
      : null
    await import_fanduel_wagers({
      authorization: auth,
      fanduel_state,
      is_settled,
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

export default import_fanduel_wagers
