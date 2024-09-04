import debug from 'debug'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { is_main, googleDrive, downloadFile } from '#libs-server'

const argv = yargs(hideBin(process.argv)).argv
const log = debug('download-backup-from-drive')
debug.enable('download-backup-from-drive')

const downloadBackupFromDrive = async (q) => {
  const drive = await googleDrive()
  const listParams = {
    q: `"1OnikVibAJ5-1uUhEyMHBRpkFGbzUM23v" in parents and trashed=false and name contains "${q}"`,
    orderBy: 'modifiedByMeTime desc',
    pageSize: 150
  }
  const res = await drive.files.list(listParams)
  const file = res.data.files[0]

  const filename = await downloadFile({ drive, file })
  log(`download ${filename}`)
}

const main = async () => {
  let error
  try {
    const q = argv.q
    if (!q) {
      console.log('missing --q')
      return
    }
    await downloadBackupFromDrive(q)
  } catch (err) {
    error = err
    log(error)
  }

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default downloadBackupFromDrive
