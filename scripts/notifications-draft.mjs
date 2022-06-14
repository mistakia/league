import dayjs from 'dayjs'

import db from '#db'
import { constants } from '#common'
import { isMain, sendNotifications, getLeague } from '#utils'

const run = async () => {
  // get lists of leagues after draft start date
  const now = dayjs().unix()
  const league_seasons = await db('leagues')
    .whereNotNull('ddate')
    .where('ddate', '<', now)

  for (const league_season of league_seasons) {
    const league = await getLeague(league_season.lid)
    const draftStart = dayjs.unix(league_season.ddate)
    const difference = dayjs().diff(draftStart, 'days')
    const pick = difference + 1

    const picks = await db('draft')
      .join('teams', 'draft.tid', 'teams.uid')
      .where({
        year: constants.season.year,
        pick
      })
      .where('draft.lid', league.uid)
      .whereNull('draft.pid')

    if (picks.length) {
      const pick = picks[0]
      const message = `${pick.name} (${pick.abbrv}) is now on the clock with the #${pick.pick} pick in the ${pick.year} draft.`
      await sendNotifications({
        league,
        teamIds: [pick.tid],
        message
      })
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

  await db('jobs').insert({
    type: constants.jobs.NOTIFICATIONS_DRAFT,
    succ: error ? 0 : 1,
    reason: error ? error.message : null,
    timestamp: Math.round(Date.now() / 1000)
  })

  process.exit()
}

if (isMain(import.meta.url)) {
  main()
}

export default run
