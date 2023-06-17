import db from '#db'

import { constants } from '#libs-shared'

export default async function ({ leagueId, teamId }) {
  const teams = await db('teams').where({
    lid: leagueId,
    year: constants.season.year
  })
  const sorted = teams.sort((a, b) => a.wo - b.wo)
  const index = sorted.findIndex((t) => t.uid === teamId)
  sorted.push(sorted.splice(index, 1)[0])

  for (const [index, team] of sorted.entries()) {
    const newWaiverOrder = index + 1
    if (newWaiverOrder !== team.wo) {
      await db('teams')
        .update('wo', newWaiverOrder)
        .where({ uid: team.uid, year: constants.season.year })
    }
  }
}
