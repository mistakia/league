import chai from 'chai'

import { getRoster, getLeague } from '#utils'
import { Roster } from '#common'

const expect = chai.expect

export default async function ({ teamId, pid, leagueId }) {
  const league = await getLeague({ lid: leagueId })
  const rosterRow = await getRoster({ tid: teamId })
  const roster = new Roster({ roster: rosterRow, league })

  const roster_player = roster.get(pid)
  expect(roster_player.pid).to.equal(pid)

  // TODO - check slot
}
