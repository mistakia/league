/* global describe it */

import * as chai from 'chai'

import { generate_fantasy_league_schedule } from '#libs-server'
import { current_season } from '#constants'

const expect = chai.expect
chai.should()

// The ten-team assertions here are the constitutional ones: Article V Section
// 13(f) says each Team plays each of the other nine once and five of them a
// second time, so a schedule that merely fills fourteen weeks is not enough --
// the doubled set must be exactly five per team AND symmetric. A construction
// that gave one team six doubles and another four would still produce 70
// matchups over 14 weeks and would pass any count-only check.

const opponents_by_team = (schedule, teams) => {
  const opponents = new Map(teams.map((team) => [team.uid, []]))

  for (const week of schedule) {
    for (const matchup of week) {
      opponents.get(matchup.home.uid).push(matchup.away.uid)
      opponents.get(matchup.away.uid).push(matchup.home.uid)
    }
  }

  return opponents
}

const count_by_opponent = (list) =>
  list.reduce((acc, uid) => acc.set(uid, (acc.get(uid) || 0) + 1), new Map())

describe('UTILS generate_fantasy_league_schedule', function () {
  const ten_teams = Array.from({ length: 10 }, (unused, i) => ({
    uid: i + 1,
    division: null
  }))

  it('satisfies Article V Section 13(f) at ten teams and no divisions', () => {
    const schedule = generate_fantasy_league_schedule(ten_teams)

    schedule.should.have.lengthOf(current_season.regularSeasonFinalWeek)
    for (const week of schedule) {
      week.should.have.lengthOf(5)
    }

    const opponents = opponents_by_team(schedule, ten_teams)
    const doubled = new Map()

    for (const team of ten_teams) {
      const counts = count_by_opponent(opponents.get(team.uid))

      // every other team, exactly once or twice, never three times
      counts.size.should.equal(9, `team ${team.uid} opponent count`)
      for (const [opponent, played] of counts.entries()) {
        expect(played).to.be.oneOf(
          [1, 2],
          `team ${team.uid} played ${opponent} ${played} times`
        )
      }

      const twice = [...counts.entries()]
        .filter(([, played]) => played === 2)
        .map(([opponent]) => opponent)

      twice.should.have.lengthOf(5, `team ${team.uid} double-played opponents`)
      doubled.set(team.uid, new Set(twice))
    }

    // symmetry: if A plays B twice then B plays A twice
    for (const [tid, opponents_twice] of doubled.entries()) {
      for (const opponent of opponents_twice) {
        doubled
          .get(opponent)
          .has(tid)
          .should.equal(true, `${tid}/${opponent} double-play is not symmetric`)
      }
    }
  })

  it('is a pure function of the team order', () => {
    const first = generate_fantasy_league_schedule(ten_teams)
    const second = generate_fantasy_league_schedule(ten_teams)

    JSON.stringify(first).should.equal(JSON.stringify(second))
  })

  it('a different drawn order gives a different schedule', () => {
    const reversed = [...ten_teams].reverse()

    JSON.stringify(
      generate_fantasy_league_schedule(ten_teams)
    ).should.not.equal(
      JSON.stringify(generate_fantasy_league_schedule(reversed))
    )
  })

  it('splits home and away evenly at ten teams', () => {
    const schedule = generate_fantasy_league_schedule(ten_teams)
    const home_games = new Map(ten_teams.map((team) => [team.uid, 0]))

    for (const week of schedule) {
      for (const matchup of week) {
        home_games.set(matchup.home.uid, home_games.get(matchup.home.uid) + 1)
      }
    }

    // 14 games each; nobody should be more than one game off an even split
    for (const [tid, count] of home_games.entries()) {
      expect(Math.abs(count - 7)).to.be.at.most(1, `team ${tid} home games`)
    }
  })

  it('generates a valid schedule for 12 teams and 4 divisions', () => {
    const teams = Array.from({ length: 12 }, (unused, i) => ({
      uid: i + 1,
      division: (i % 4) + 1
    }))

    const schedule = generate_fantasy_league_schedule(teams)
    schedule.should.have.lengthOf(current_season.regularSeasonFinalWeek)

    const opponents = opponents_by_team(schedule, teams)

    for (const team of teams) {
      const counts = count_by_opponent(opponents.get(team.uid))
      for (const [opponent, played] of counts.entries()) {
        const other = teams.find((t) => t.uid === opponent)
        if (team.division === other.division) {
          played.should.equal(2)
        } else {
          expect(played).to.be.oneOf([1, 2])
        }
      }
    }
  })

  it('refuses a division structure the constitution does not describe', () => {
    const two_divisions = Array.from({ length: 10 }, (unused, i) => ({
      uid: i + 1,
      division: (i % 2) + 1
    }))

    expect(() => generate_fantasy_league_schedule(two_divisions)).to.throw(
      /unsupported division count/
    )
  })

  it('refuses a league that is part divided and part not', () => {
    const mixed = ten_teams.map((team, i) => ({
      ...team,
      division: i < 5 ? 1 : null
    }))

    expect(() => generate_fantasy_league_schedule(mixed)).to.throw(
      /either has Divisions or it does not/
    )
  })

  it('refuses an odd number of teams', () => {
    expect(() =>
      generate_fantasy_league_schedule(ten_teams.slice(0, 9))
    ).to.throw(/odd number of teams/)
  })
})
