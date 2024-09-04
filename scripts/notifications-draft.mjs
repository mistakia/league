import dayjs from 'dayjs'
import debug from 'debug'

import db from '#db'
import { constants } from '#libs-shared'
import { is_main, getLeague, report_job } from '#libs-server'
import { job_types } from '#libs-shared/job-constants.mjs'

const log = debug('notifications-draft')
debug.enable('notifications-draft')

const run = async () => {
  // get lists of leagues after draft start date
  const now = dayjs().unix()
  const league_seasons = await db('leagues')
    .leftJoin('seasons', function () {
      this.on('leagues.uid', '=', 'seasons.lid')
      this.on(
        db.raw(
          `seasons.year = ${constants.season.year} or seasons.year is null`
        )
      )
    })
    .whereNotNull('draft_start')
    .where('draft_start', '<', now)

  for (const league_season of league_seasons) {
    const { lid } = league_season
    const league = await getLeague({ lid })
    const draftStart = dayjs.unix(league_season.draft_start)
    const difference = dayjs().diff(draftStart, 'days')
    const pick = difference + 1

    const picks = await db('draft')
      .join('teams', 'draft.tid', 'teams.uid')
      .where('draft.year', constants.season.year)
      .where('teams.year', constants.season.year)
      .where('draft.pick', pick)
      .where('draft.lid', league.uid)
      .whereNull('draft.pid')

    if (picks.length) {
      const pick = picks[0]
      const message = `${pick.name} (${pick.abbrv}) is now on the clock with the #${pick.pick} pick in the ${pick.year} draft.`

      log(message)

      // TODO - outdated, needs updating

      /* await sendNotifications({
       *   league,
       *   teamIds: [pick.tid],
       *   message
       * }) */
    }
  }
}

const main = async () => {
  let error
  try {
    await run()
  } catch (err) {
    error = err
    console.log(error)
  }

  await report_job({
    job_type: job_types.NOTIFICATIONS_DRAFT,
    error
  })

  process.exit()
}

if (is_main(import.meta.url)) {
  main()
}

export default run
