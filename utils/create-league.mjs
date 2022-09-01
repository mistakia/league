import db from '#db'
import { constants, createDefaultLeague } from '#common'

export default async function ({ lid, commishid, ...params } = {}) {
  const defaultLeague = createDefaultLeague({ commishid })
  const { name, nteams, hosted, host, ...season } = Object.assign(
    {},
    defaultLeague,
    params
  )

  const league = {
    commishid,
    name,
    nteams,
    hosted,
    host
  }

  if (lid) league.uid = lid

  const leagues = await db('leagues').insert(league)
  const leagueId = leagues[0]

  for (const position of constants.positions) {
    delete season[`b_${position}`]
  }

  delete season.processed_at
  delete season.commishid

  await db('seasons').insert({
    lid: leagueId,
    year: constants.season.year,
    ...season
  })

  return leagueId
}
