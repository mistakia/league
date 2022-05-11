import chai from 'chai'

import { getRoster, getLeague } from '#utils'
import { Roster } from '#common'

const expect = chai.expect

export default async function ({ teamId, player, leagueId }) {
  const league = await getLeague(leagueId)
  const rosterRow = await getRoster({ tid: teamId })
  const roster = new Roster({ roster: rosterRow, league })

  const p = roster.get(player)
  expect(p.player).to.equal(player)

  // TODO - check slot
}
