import fs from 'fs'
import cp from 'child_process'

import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import db from '#db'
import { isMain, googleDrive, downloadFile } from '#utils'
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
  user,
  download_only = false
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
    file = res.data.files.find((f) => f.name.includes('full'))
  } else if (logs) {
    file = res.data.files.find((f) => f.name.includes('logs'))
  } else if (betting) {
    file = res.data.files.find((f) => f.name.includes('betting'))
  } else if (stats) {
    file = res.data.files.find((f) => f.name.includes('stats'))
  } else if (cache) {
    file = res.data.files.find((f) => f.name.includes('cache'))
  } else {
    file = res.data.files.find((f) => f.name.includes('user'))
  }

  if (!file) {
    log('file not found')
    return
  }

  const filename = await downloadFile({ drive, file })

  const { user: mysql_user, database } = config.mysql.connection
  const sqlFile = filename.replace('tar.gz', 'sql')
  try {
    cp.execSync(`tar -xvzf ${filename}`)

    if (download_only) {
      return
    }

    cp.execSync(`mysql -h 127.0.0.1 -u ${mysql_user} -e "RESET MASTER"`)
    cp.execSync(`mysql -h 127.0.0.1 -u ${mysql_user} ${database} < ${sqlFile}`)
    log(`imported ${sqlFile} into mysql`)

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
      fs.unlinkSync(sqlFile)
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
    const user = argv.user
    const cache = argv.cache
    const download_only = argv.download
    await run({ full, logs, stats, user, cache, download_only, betting })
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
