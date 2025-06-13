import dayjs from 'dayjs'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { constants } from '#libs-shared'
import { getLeague } from '#libs-server'
import db from '#db'
import is_main from './is-main.mjs'
import set_draft_pick_number from '#scripts/set-draft-pick-number.mjs'

const argv = yargs(hideBin(process.argv)).argv

const create_conditional_pick = async function ({ tid, league }) {
  const is_before_draft = league.draft_start
    ? constants.season.now.isBefore(dayjs.unix(league.draft_start))
    : true
  const year = is_before_draft
    ? constants.season.year
    : constants.season.year + 1

  let pick
  if (is_before_draft) {
    const last_pick = await db('draft')
      .where({ year: constants.season.year, lid: league.uid })
      .max('pick as max_pick')
    pick = last_pick[0].max_pick ? last_pick[0].max_pick + 1 : null
  } else {
    pick = null
  }

  await db('draft').insert({
    tid,
    lid: league.uid,
    otid: tid,
    comp: 1,
    round: 4,
    year,
    pick
  })

  // Call set-draft-pick-number when year is current year and before draft
  if (year === constants.season.year && is_before_draft) {
    await set_draft_pick_number({ lid: league.uid })
  }
}

export default create_conditional_pick

if (is_main(import.meta.url)) {
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
    await create_conditional_pick({
      tid,
      league
    })
  }

  run()
}
