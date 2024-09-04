import debug from 'debug'

import { googleDrive, is_main } from '#libs-server'
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

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}
