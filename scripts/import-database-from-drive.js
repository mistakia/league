// eslint-disable-next-line
require = require('esm')(module /*, options*/)
const debug = require('debug')
const fs = require('fs')
const cp = require('child_process')
const argv = require('yargs').argv

const config = require('../config')
const { googleDrive } = require('../utils')

const log = debug('import-database-from-drive')
debug.enable('import-database-from-drive')

const downloadFile = ({ drive, file }) =>
  new Promise((resolve, reject) => {
    const filename = file.name
    const dest = fs.createWriteStream(`./${filename}`)
    log('downloading', filename)

    drive.files.get(
      {
        fileId: file.id,
        alt: 'media'
      },
      {
        responseType: 'stream'
      },
      (err, res) => {
        if (err) {
          return reject(err)
        }

        res.data
          .on('end', function () {
            log('download complete', filename)
            resolve(filename)
          })
          .on('error', function (err) {
            console.log(err)
          })
          .pipe(dest)
      }
    )
  })

const run = async ({ full = false } = {}) => {
  const drive = await googleDrive()
  const listParams = {
    q: '"1OnikVibAJ5-1uUhEyMHBRpkFGbzUM23v" in parents and trashed=false',
    orderBy: 'modifiedByMeTime desc',
    pageSize: 150
  }
  const res = await drive.files.list(listParams)

  const file = full
    ? res.data.files.find((f) => f.name.includes('full'))
    : res.data.files.find((f) => !f.name.includes('full'))

  if (!file) {
    log('file not found')
    return
  }

  const filename = await downloadFile({ drive, file })

  const { user, database } = config.mysql.connection
  const sqlFile = filename.replace('tar.gz', 'sql')
  cp.exec(
    `tar -xvzf ${filename} && mysql -h 127.0.0.1 -u ${user} ${database} < ${sqlFile}`,
    (error, stdout, stderr) => {
      fs.unlinkSync(filename)
      fs.unlinkSync(sqlFile)

      if (error) throw error
      log(`imported ${sqlFile} into mysql`)
    }
  )

  // clear database notification info
  await db('users').update('phone', null)
  await db('leagues').update({
    groupme_token: null,
    groupme_id: null,
    discord_webhook_url: null
  })
}

module.exports = run

const main = async () => {
  let error
  try {
    const full = argv.full
    await run({ full })
  } catch (err) {
    error = err
    console.log(error)
  }

  // process.exit()
}

if (!module.parent) {
  main()
}
