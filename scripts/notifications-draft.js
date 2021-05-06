// eslint-disable-next-line
require = require('esm')(module /*, options*/)
const moment = require('moment')
const API = require('groupme').Stateless

const { constants } = require('../common')
const { sendNotifications } = require('../utils')
const db = require('../db')

const run = async () => {
  // get lists of leagues after draft start date
  const now = moment().format('X')
  const leagues = await db('leagues')
    .whereNotNull('ddate')
    .where('ddate', '<', now)

  for (const league of leagues) {
    const draftStart = moment(league.ddate, 'X')
    const difference = moment().diff(draftStart, 'days')
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
        leagueId: league.uid,
        teamIds: [pick.tid],
        message
      })

      if (league.groupme_token && league.groupme_id) {
        await API.Bots.post.Q(
          league.groupme_token,
          league.groupme_id,
          message,
          {}
        )
      }
    }
  }

  process.exit()
}

try {
  run()
} catch (error) {
  console.log(error)
}
