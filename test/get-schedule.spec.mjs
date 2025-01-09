/* global describe it */

import * as chai from 'chai'

import { getSchedule } from '#libs-server'
import { constants } from '#libs-shared'

chai.should()

describe('UTILS getSchedule', function () {
  it('generates a valid schedule for 12 teams and 4 divisions', () => {
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

    schedule.should.have.lengthOf(constants.season.regularSeasonFinalWeek)
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
          // should equal 1 or 2
          occurences.should.be.oneOf([1, 2])
        }
      }
    }
  })

  it('generates a valid schedule for 10 teams and 2 divisions', () => {
    const teams = []
    const schedulePerTeam = {}
    for (let i = 1; i <= 10; i++) {
      schedulePerTeam[i] = []
      teams.push({
        uid: i,
        div: (i % 2) + 1
      })
    }

    const schedule = getSchedule(teams)
    schedule.should.have.lengthOf(constants.season.regularSeasonFinalWeek)

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
          // should equal 1 or 2
          occurences.should.be.oneOf([1, 2])
        }
      }
    }
  })
})
