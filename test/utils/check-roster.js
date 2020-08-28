const chai = require('chai')

const { getRoster, getLeague } = require('../../utils')
const { Roster } = require('../../common')

const expect = chai.expect

module.exports = async ({ teamId, player, leagueId }) => {
  const league = await getLeague(leagueId)
  const rosterRow = await getRoster({ tid: teamId })
  const roster = new Roster({ roster: rosterRow, league })

  const p = roster.get(player)
  expect(p.player).to.equal(player)

  // TODO - check slot
}
