import db from '#db'
import { constants, createDefaultLeague } from '#common'

import generate_league_format_hash from './generate-league-format-hash.mjs'
import generate_scoring_format_hash from './generate-scoring-format-hash.mjs'

export default async function ({ lid, commishid, ...params } = {}) {
  const defaultLeague = createDefaultLeague({ commishid })
  const { name, num_teams, hosted, host, ...season } = Object.assign(
    {},
    defaultLeague,
    params
  )

  const league = {
    commishid,
    name,
    num_teams,
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
    league_format_hash: generate_league_format_hash({ ...league, ...season }),
    scoring_format_hash: generate_scoring_format_hash(season),
    ...season
  })

  return leagueId
}
