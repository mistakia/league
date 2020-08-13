const chai = require('chai')

const { getRoster, getLeague } = require('../../utils')
const { Roster } = require('../../common')

const expect = chai.expect

module.exports = async ({ teamId, player, leagueId }) => {
  const league = await getLeague(leagueId)
  const rosterRow = await getRoster({ tid: teamId })
  const roster = new Roster({ roster: rosterRow, league })

  expect(roster.has(player)).to.equal(true)
}
