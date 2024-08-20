import debug from 'debug'

import { googleDrive, isMain } from '#libs-server'
// import { job_types } from '#libs-shared/job-constants.mjs'

const log = debug('cleanup-backups')
debug.enable('cleanup-backups')

const run = async () => {
  const drive = await googleDrive()
  const listParams = {
    q: '"1OnikVibAJ5-1uUhEyMHBRpkFGbzUM23v" in parents',
    orderBy: 'modifiedByMeTime asc',
    pageSize: 150
  }
  const res = await drive.files.list(listParams)
  log(res.data)
}

export default run

const main = async () => {
  let error
  try {
    await run()
  } catch (err) {
    error = err
    console.log(error)
  }

  /* await db('jobs').insert({
   *   type: job_types.CLEANUP_BACKUPS,
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
