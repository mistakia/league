import dayjs from 'dayjs'
import debug from 'debug'

import db from '#db'
import { constants } from '#common'
import { isMain, sendNotifications } from '#utils'

const run = async () => {
  // get lists of leagues after draft start date
  const now = dayjs().unix()
  const leagues = await db('leagues')
    .whereNotNull('ddate')
    .where('ddate', '<', now)

  for (const league of leagues) {
    const draftStart = dayjs.unix(league.ddate)
    const difference = dayjs().diff(draftStart, 'days')
    const pick = difference + 1

    const picks = await db('draft')
      .join('teams', 'draft.tid', 'teams.uid')
      .where({
        year: constants.season.year,
        pick
      })
      .where('draft.lid', league.uid)
      .whereNull('draft.player')

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

  process.exit()
}

try {
  run()
} catch (error) {
  console.log(error)
}
