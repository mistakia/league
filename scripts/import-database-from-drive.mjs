import fs from 'fs'
import cp from 'child_process'
import path, { dirname } from 'path'
import { fileURLToPath } from 'url'

import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { isMain, googleDrive, downloadFile } from '#libs-server'
import config from '#config'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('import-database-from-drive')
debug.enable('import-database-from-drive')

const run = async ({
  full,
  logs,
  stats,
  betting,
  cache,
  download_only = false,
  reset = false
} = {}) => {
  const drive = await googleDrive()
  const listParams = {
    q: '"1OnikVibAJ5-1uUhEyMHBRpkFGbzUM23v" in parents and trashed=false',
    orderBy: 'modifiedByMeTime desc',
    pageSize: 150
  }
  const res = await drive.files.list(listParams)

  let file
  if (full) {
    log('loading full database')
    file = res.data.files.find((f) => f.name.includes('full'))
  } else if (logs) {
    log('loading logs')
    file = res.data.files.find((f) => f.name.includes('logs'))
  } else if (betting) {
    log('loading betting')
    file = res.data.files.find((f) => f.name.includes('betting'))
  } else if (stats) {
    log('loading stats')
    file = res.data.files.find((f) => f.name.includes('stats'))
  } else if (cache) {
    log('loading cache')
    file = res.data.files.find((f) => f.name.includes('cache'))
  } else {
    log('loading user')
    file = res.data.files.find((f) => f.name.includes('user'))
  }

  if (!file) {
    log('file not found')
    return
  }
  const filename = await downloadFile({ drive, file })

  const { user: postgres_user, database } = config.postgres.connection
  const sql_file = filename.replace('tar.gz', 'sql')
  try {
    cp.execSync(`tar -xvzf ${filename}`)

    if (download_only) {
      return
    }

    // reset database and load schema
    if (reset) {
      const __dirname = dirname(fileURLToPath(import.meta.url))
      const schema_file = path.resolve(__dirname, '../db/schema.postgres.sql')
      cp.execSync(
        `psql -h localhost -U ${postgres_user} -d ${database} -f ${schema_file}`,
        {
          maxBuffer: 1024 * 1024 * 100, // Increase buffer size to 100MB
          stdio: 'inherit' // Inherit stdio to see real-time output
        }
      )
    }

    // Import the SQL file
    cp.execSync(
      `psql -h localhost -U ${postgres_user} -d ${database} -f ${sql_file}`,
      {
        maxBuffer: 1024 * 1024 * 100, // Increase buffer size to 100MB
        stdio: 'inherit' // Inherit stdio to see real-time output
      }
    )
    log(`imported ${sql_file} into postgres`)

    // clear database notification info
    await db('users').update('phone', null)
    await db('leagues').update({
      groupme_token: null,
      groupme_id: null,
      discord_webhook_url: null
    })
  } finally {
    if (!download_only) {
      fs.unlinkSync(filename)
      fs.unlinkSync(sql_file)
    }
  }
}

const main = async () => {
  let error
  try {
    const full = argv.full
    const logs = argv.logs
    const stats = argv.stats
    const betting = argv.betting
    const cache = argv.cache
    const download_only = argv.download
    const reset = argv.reset
    await run({ full, logs, stats, cache, download_only, betting, reset })
  } catch (err) {
    error = err
    console.log(error)
  }

  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}

export default run
