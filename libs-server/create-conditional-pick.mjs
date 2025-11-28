import dayjs from 'dayjs'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { current_season } from '#constants'
import { getLeague } from '#libs-server'
import db from '#db'
import is_main from './is-main.mjs'
import set_draft_pick_number from '#scripts/set-draft-pick-number.mjs'

const create_conditional_pick = async function ({ tid, league }) {
  const is_before_draft = league.draft_start
    ? current_season.now.isBefore(dayjs.unix(league.draft_start))
    : true
  const year = is_before_draft ? current_season.year : current_season.year + 1

  let pick
  if (is_before_draft) {
    const last_pick = await db('draft')
      .where({ year: current_season.year, lid: league.uid })
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
  if (year === current_season.year && is_before_draft) {
    await set_draft_pick_number({ lid: league.uid })
  }
}

export default create_conditional_pick

const initialize_cli = () => {
  return yargs(hideBin(process.argv))
    .option('tid', {
      describe: 'Team ID',
      type: 'number',
      demandOption: true
    })
    .option('lid', {
      describe: 'League ID',
      type: 'number',
      demandOption: true
    })
    .help().argv
}

if (is_main(import.meta.url)) {
  const run = async () => {
    const argv = initialize_cli()

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
