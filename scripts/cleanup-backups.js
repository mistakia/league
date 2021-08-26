// eslint-disable-next-line
require = require('esm')(module /*, options*/)
const debug = require('debug')

const { googleDrive } = require('../utils')

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

module.exports = run

const main = async () => {
  let error
  try {
    await run()
  } catch (err) {
    error = err
    console.log(error)
  }

  /* await db('jobs').insert({
   *   type: constants.jobs.CLEANUP_BACKUPS,
   *   succ: error ? 0 : 1,
   *   reason: error ? error.message : null,
   *   timestamp: Math.round(Date.now() / 1000)
   * })
   */
  process.exit()
}

if (!module.parent) {
  main()
}
