import dayjs from 'dayjs'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { constants } from '#libs-shared'
import { getLeague } from '#libs-server'
import db from '#db'
import isMain from './is-main.mjs'

const argv = yargs(hideBin(process.argv)).argv

const createConditionalPick = async function ({ tid, league }) {
  const isBeforeDraft = league.draft_start
    ? constants.season.now.isBefore(dayjs.unix(league.draft_start))
    : true
  const year = isBeforeDraft ? constants.season.year : constants.season.year + 1
  await db('draft').insert({
    tid,
    lid: league.uid,
    otid: tid,
    comp: 1,
    round: 4,
    year
  })
}

export default createConditionalPick

if (isMain(import.meta.url)) {
  const run = async () => {
    const tid = argv.tid
    if (!tid) {
      console.log('missing --tid')
      return
    }

    const lid = argv.lid
    if (!lid) {
      console.log('missing --lid')
      return
    }

    const league = await getLeague({ lid })
    await createConditionalPick({
      tid,
      league
    })
  }

  run()
}
