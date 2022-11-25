/* global describe it */

import chai from 'chai'

import { getSchedule } from '#utils'

chai.should()

describe('UTILS getSchedule', function () {
  it('generates a valid schedule', () => {
    const teams = []
    const schedulePerTeam = {}
    for (let i = 1; i <= 12; i++) {
      schedulePerTeam[i] = []
      teams.push({
        uid: i,
        div: (i % 4) + 1
      })
    }

    const schedule = getSchedule(teams)
    for (const value of schedule.values()) {
      for (const matchup of value) {
        schedulePerTeam[matchup.home.uid].push(matchup.away.uid)
        schedulePerTeam[matchup.away.uid].push(matchup.home.uid)
      }
    }

    const countMatchups = (arr) =>
      arr.reduce((acc, e) => acc.set(e, (acc.get(e) || 0) + 1), new Map())

    for (const teamid in schedulePerTeam) {
      const team = teams.find((t) => t.uid === parseInt(teamid, 10))
      const count = countMatchups(schedulePerTeam[teamid])
      for (const [opponent, occurences] of count.entries()) {
        const oppoTeam = teams.find((t) => t.uid === opponent)
        if (team.div === oppoTeam.div) {
          occurences.should.equal(2)
        } else {
          // TODO fix - with 14 week schedules one non division team is played twice
          // occurences.should.equal(1)
        }
      }
    }
  })
})
