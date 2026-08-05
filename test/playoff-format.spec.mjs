/* global describe it */

import * as chai from 'chai'

import {
  get_playoff_seeding,
  compare_playoff_seed,
  compare_all_play_seed,
  compare_at_large_berth
} from '#libs-shared'
import { current_season } from '#constants'
import generate_fantasy_league_schedule from '#libs-server/generate-fantasy-league-schedule.mjs'

const expect = chai.expect

const make_teams = (num_teams, num_divisions) =>
  Array.from({ length: num_teams }, (unused, i) => ({
    uid: i + 1,
    division: (i % num_divisions) + 1
  }))

const opponent_counts = (schedule, uid) => {
  const counts = {}
  for (const week of schedule) {
    for (const { home, away } of week) {
      if (home.uid === uid) counts[away.uid] = (counts[away.uid] || 0) + 1
      if (away.uid === uid) counts[home.uid] = (counts[home.uid] || 0) + 1
    }
  }
  return counts
}

describe('playoff format and division schedule', function () {
  describe('get_playoff_seeding', function () {
    const team = (tid, division, overrides) => ({
      tid,
      division,
      regular_season_wins: 0,
      regular_season_losses: 0,
      regular_season_ties: 0,
      all_play_wins: 0,
      all_play_losses: 0,
      all_play_ties: 0,
      points_for: 0,
      ...overrides
    })

    // Three teams per division across four divisions, with tid ascending in
    // strength so the expected seed order is simply 1..12.
    const twelve = Array.from({ length: 12 }, (unused, i) =>
      team(i + 1, (i % 4) + 1, {
        regular_season_wins: 12 - i,
        regular_season_losses: i
      })
    )

    // All-play records that run OPPOSITE to head-to-head: tid 12 is the best
    // all-play team and tid 1 the worst. Any test whose expectation differs
    // between the two ladders is therefore unambiguous about which one ran.
    const all_play_inverted = twelve.map((t) =>
      team(t.tid, t.division, {
        regular_season_wins: t.regular_season_wins,
        regular_season_losses: t.regular_season_losses,
        all_play_wins: 10 * t.tid,
        all_play_losses: 126 - 10 * t.tid
      })
    )

    it('honors the configured field size and bye count', function () {
      const result = get_playoff_seeding({
        teams: twelve,
        playoff_team_count: 6,
        bye_count: 2
      })

      expect(result.playoff_tids).to.eql([1, 2, 3, 4, 5, 6])
      expect(result.bye_tids).to.eql([1, 2])
      expect(result.wildcard_tids).to.eql([3, 4, 5, 6])
      expect(result.seeded_tids.length).to.equal(12)
    })

    it('supports a different field size and bye count', function () {
      const result = get_playoff_seeding({
        teams: twelve,
        playoff_team_count: 4,
        bye_count: 0
      })

      expect(result.playoff_tids).to.eql([1, 2, 3, 4])
      expect(result.bye_tids).to.eql([])
      expect(result.wildcard_tids).to.eql([1, 2, 3, 4])
    })

    it('ignores divisions when has_division_winner_berths is false', function () {
      const result = get_playoff_seeding({
        teams: twelve,
        playoff_team_count: 6,
        bye_count: 2,
        has_division_winner_berths: false
      })

      expect(result.playoff_tids).to.eql([1, 2, 3, 4, 5, 6])
    })

    // The ten-team shape: no divisions, so every team is bye-eligible and the
    // byes are the best All Play records in the league.
    it('selects byes on all play across the whole league', function () {
      const ten = Array.from({ length: 10 }, (unused, i) =>
        team(i + 1, 1, {
          regular_season_wins: 12 - i,
          regular_season_losses: i,
          all_play_wins: 10 * (i + 1),
          all_play_losses: 110 - 10 * (i + 1)
        })
      )

      const result = get_playoff_seeding({
        teams: ten,
        playoff_team_count: 6,
        bye_count: 2,
        bye_candidate_pool: 'league',
        bye_selection_method: 'all_play'
      })

      // All play runs opposite to head-to-head here, so the byes are the two
      // WORST head-to-head teams. Nothing but the all-play ladder produces this.
      expect(result.bye_tids).to.eql([10, 9])
      // The rest of the field is still ordered on the standings ladder.
      expect(result.wildcard_tids).to.eql([1, 2, 3, 4])
      expect(result.playoff_tids).to.eql([10, 9, 1, 2, 3, 4])
    })

    // The twelve-team shape: four divisions, and only division winners are
    // bye-eligible, ranked among themselves on All Play.
    it('restricts byes to division winners ranked on all play', function () {
      const result = get_playoff_seeding({
        teams: all_play_inverted,
        playoff_team_count: 6,
        bye_count: 2,
        bye_candidate_pool: 'division_winners',
        bye_selection_method: 'all_play'
      })

      // Division winners are tids 1-4 (best head-to-head in each division).
      // Among those four, all play ranks tid 4 first and tid 3 second -- so a
      // team with the fourth-best record in the league takes the top bye, and
      // tids 9-12, who lead the league on all play, get no bye at all because
      // they did not win a division.
      expect(result.bye_tids).to.eql([4, 3])
      expect(result.wildcard_tids).to.eql([1, 2, 5, 6])
    })

    it('does not let the bye ladder reorder the rest of the field', function () {
      const result = get_playoff_seeding({
        teams: all_play_inverted,
        playoff_team_count: 6,
        bye_count: 2,
        bye_candidate_pool: 'league',
        bye_selection_method: 'all_play'
      })

      expect(result.bye_tids).to.eql([12, 11])
      // Seeds 3 through 6 are the best remaining on head-to-head, not on all
      // play -- the two ladders are applied to different steps.
      expect(result.wildcard_tids).to.eql([1, 2, 3, 4])
    })

    it('decides a tied division title on all play, not points for', function () {
      // Two teams tied at 9-5 in division 1. tid 1 has the better all play
      // record; tid 2 has scored far more. The standings ladder decides a
      // division title, and it breaks a head-to-head tie on all play before
      // points for -- so tid 1 wins the division and takes the bye.
      const teams = [
        team(1, 1, {
          regular_season_wins: 9,
          regular_season_losses: 5,
          points_for: 100,
          all_play_wins: 116,
          all_play_losses: 10
        }),
        team(2, 1, {
          regular_season_wins: 9,
          regular_season_losses: 5,
          points_for: 900,
          all_play_wins: 10,
          all_play_losses: 116
        }),
        team(3, 2, {
          regular_season_wins: 4,
          regular_season_losses: 10,
          points_for: 50
        }),
        team(4, 2, {
          regular_season_wins: 3,
          regular_season_losses: 11,
          points_for: 40
        })
      ]

      const result = get_playoff_seeding({
        teams,
        playoff_team_count: 2,
        bye_count: 1,
        bye_candidate_pool: 'division_winners',
        bye_selection_method: 'all_play'
      })

      expect(result.bye_tids).to.eql([1])
    })

    // The full twelve-team shape: four division winners berthed, two of them on
    // byes, and the last two places at large on points for.
    it('fills at-large berths on points for', function () {
      const teams = all_play_inverted.map((t) =>
        team(t.tid, t.division, {
          regular_season_wins: t.regular_season_wins,
          regular_season_losses: t.regular_season_losses,
          all_play_wins: t.all_play_wins,
          all_play_losses: t.all_play_losses,
          // tids 11 and 12 have the worst records in the league and the most
          // points. Nothing but a points-for ladder puts them in the field.
          points_for: t.tid >= 11 ? 2000 : 100
        })
      )

      const result = get_playoff_seeding({
        teams,
        playoff_team_count: 6,
        bye_count: 2,
        bye_candidate_pool: 'division_winners',
        bye_selection_method: 'all_play',
        at_large_selection_method: 'points_for',
        has_division_winner_berths: true
      })

      // Division winners are tids 1-4. All play ranks 4 and 3 highest among
      // them, so those take the byes; 1 and 2 are berthed as winners; the two
      // at-large places go to 11 and 12 on points for, NOT to tids 5 and 6 who
      // have far better records.
      expect(result.bye_tids).to.eql([4, 3])
      expect(result.playoff_tids).to.have.members([4, 3, 1, 2, 11, 12])
      expect(result.wildcard_tids).to.have.members([1, 2, 11, 12])
    })

    it('leaves the at-large ladder off the seed order', function () {
      const teams = all_play_inverted.map((t) =>
        team(t.tid, 1, {
          regular_season_wins: t.regular_season_wins,
          regular_season_losses: t.regular_season_losses,
          points_for: t.tid >= 11 ? 2000 : 100
        })
      )

      const result = get_playoff_seeding({
        teams,
        playoff_team_count: 4,
        bye_count: 0,
        at_large_selection_method: 'points_for'
      })

      // 11 and 12 take berths on points for, but the field is still ordered on
      // the standings ladder, so the better records seed ahead of them.
      expect(result.playoff_tids).to.eql([1, 2, 11, 12])
    })

    // Regression: calculate-standings must not throw for a league/year with no
    // seasons row. getLeague LEFT JOINs seasons, so every format field comes
    // back null -- and league 1 already has teams rows for 2027 with no 2027
    // seasons row, so process-matchups would abort on it.
    it('orders standings on the ladder when no playoff format is set', function () {
      const teams = twelve.map((t) => ({ ...t }))
      const league = {
        playoff_team_count: null,
        bye_count: null,
        bye_candidate_pool: null,
        bye_selection_method: null,
        at_large_selection_method: null,
        has_division_winner_berths: null
      }

      const has_playoff_format = Number.isInteger(league.playoff_team_count)
      expect(has_playoff_format).to.equal(false)

      const seeded_tids = [...teams]
        .sort(compare_playoff_seed)
        .map((team) => team.tid)

      // Identical to what the configured defaults produce.
      const with_defaults = get_playoff_seeding({
        teams,
        playoff_team_count: 6,
        bye_count: 2
      }).seeded_tids

      expect(seeded_tids).to.eql(with_defaults)
      expect(seeded_tids.length).to.equal(12)
    })

    it('throws when the division winner pool cannot fill the byes', function () {
      const single_division = Array.from({ length: 10 }, (unused, i) =>
        team(i + 1, 1, {
          regular_season_wins: 12 - i,
          regular_season_losses: i
        })
      )

      expect(() =>
        get_playoff_seeding({
          teams: single_division,
          playoff_team_count: 6,
          bye_count: 2,
          bye_candidate_pool: 'division_winners'
        })
      ).to.throw(/candidate/)
    })

    it('guarantees a losing division winner a berth when configured to', function () {
      const teams = [
        team(1, 1, { regular_season_wins: 12, regular_season_losses: 2 }),
        team(2, 1, { regular_season_wins: 11, regular_season_losses: 3 }),
        team(3, 1, { regular_season_wins: 10, regular_season_losses: 4 }),
        team(4, 2, { regular_season_wins: 4, regular_season_losses: 10 }),
        team(5, 2, { regular_season_wins: 3, regular_season_losses: 11 }),
        team(6, 2, { regular_season_wins: 2, regular_season_losses: 12 })
      ]

      const without = get_playoff_seeding({
        teams,
        playoff_team_count: 2,
        bye_count: 0
      })
      expect(without.playoff_tids).to.eql([1, 2])

      const with_guarantee = get_playoff_seeding({
        teams,
        playoff_team_count: 2,
        bye_count: 0,
        has_division_winner_berths: true
      })
      // tid 4 has a losing record but wins division 2.
      expect(with_guarantee.playoff_tids).to.eql([1, 4])
    })

    it('guarantees a berth without promoting the seed', function () {
      const teams = [
        team(1, 1, { regular_season_wins: 12, regular_season_losses: 2 }),
        team(2, 1, { regular_season_wins: 11, regular_season_losses: 3 }),
        team(3, 1, { regular_season_wins: 10, regular_season_losses: 4 }),
        team(4, 1, { regular_season_wins: 9, regular_season_losses: 5 }),
        team(5, 2, { regular_season_wins: 4, regular_season_losses: 10 }),
        team(6, 2, { regular_season_wins: 3, regular_season_losses: 11 })
      ]

      const result = get_playoff_seeding({
        teams,
        playoff_team_count: 4,
        bye_count: 0,
        has_division_winner_berths: true
      })

      // tid 5 wins division 2 on a losing record and displaces tid 4, but it
      // seeds LAST in the field rather than being lifted to the front.
      expect(result.playoff_tids).to.eql([1, 2, 3, 5])
    })

    it('rejects a missing or nonsensical playoff configuration', function () {
      expect(() =>
        get_playoff_seeding({ teams: twelve, bye_count: 2 })
      ).to.throw(/playoff_team_count/)

      expect(() =>
        get_playoff_seeding({
          teams: twelve,
          playoff_team_count: 6,
          bye_count: 7
        })
      ).to.throw(/bye_count/)

      expect(() =>
        get_playoff_seeding({
          teams: twelve,
          playoff_team_count: 6,
          bye_count: 2,
          bye_candidate_pool: 'best_mascot'
        })
      ).to.throw(/bye_candidate_pool/)

      expect(() =>
        get_playoff_seeding({
          teams: twelve,
          playoff_team_count: 6,
          bye_count: 2,
          bye_selection_method: 'coin_flip'
        })
      ).to.throw(/bye_selection_method/)
    })

    it('caps the field at the teams that exist rather than throwing', function () {
      // A league mid-setup has fewer teams than its configured field size.
      // Standings still have to compute.
      const four = twelve.slice(0, 4)
      const result = get_playoff_seeding({
        teams: four,
        playoff_team_count: 6,
        bye_count: 2
      })

      expect(result.playoff_tids).to.eql([1, 2, 3, 4])
      expect(result.bye_tids).to.eql([1, 2])
    })
  })

  describe('compare_at_large_berth', function () {
    const team = (overrides) => ({
      all_play_wins: 0,
      all_play_losses: 0,
      all_play_ties: 0,
      points_for: 0,
      ...overrides
    })

    it('orders on points for, ignoring record entirely', function () {
      const higher = team({
        points_for: 1500,
        regular_season_wins: 2,
        regular_season_losses: 12
      })
      const lower = team({
        points_for: 1400,
        regular_season_wins: 12,
        regular_season_losses: 2
      })
      expect(compare_at_large_berth(higher, lower)).to.be.below(0)
    })

    it('breaks a points for tie on all play', function () {
      const a = team({
        points_for: 1500,
        all_play_wins: 90,
        all_play_losses: 36
      })
      const b = team({
        points_for: 1500,
        all_play_wins: 40,
        all_play_losses: 86
      })
      expect(compare_at_large_berth(a, b)).to.be.below(0)
    })
  })

  describe('compare_all_play_seed', function () {
    const team = (overrides) => ({
      all_play_wins: 0,
      all_play_losses: 0,
      all_play_ties: 0,
      points_for: 0,
      ...overrides
    })

    it('orders on all play win percentage, not raw wins', function () {
      // Fewer wins over far fewer games is the better percentage.
      const better = team({ all_play_wins: 30, all_play_losses: 10 })
      const worse = team({ all_play_wins: 60, all_play_losses: 66 })
      expect(compare_all_play_seed(better, worse)).to.be.below(0)
    })

    it('counts a tie as half a win', function () {
      const a = team({ all_play_wins: 5, all_play_losses: 3, all_play_ties: 2 })
      const b = team({ all_play_wins: 6, all_play_losses: 4 })
      // Both are .600; the tie is broken on points for below.
      expect(compare_all_play_seed(a, b)).to.equal(0)
    })

    it('breaks an all play tie on points for', function () {
      const a = team({
        all_play_wins: 70,
        all_play_losses: 56,
        points_for: 900
      })
      const b = team({
        all_play_wins: 70,
        all_play_losses: 56,
        points_for: 100
      })
      expect(compare_all_play_seed(a, b)).to.be.below(0)
    })

    it('treats a team with no all play record as zero rather than NaN', function () {
      const none = team({})
      const some = team({ all_play_wins: 1, all_play_losses: 1 })
      expect(compare_all_play_seed(some, none)).to.be.below(0)
    })
  })

  describe('compare_playoff_seed', function () {
    // all_play_losses matters: the ladder runs on All Play PERCENTAGE, so a
    // fixture that sets only all_play_wins gives every team 1.000 and the term
    // silently drops out.
    const team = (overrides) => ({
      regular_season_wins: 0,
      regular_season_losses: 0,
      regular_season_ties: 0,
      all_play_wins: 0,
      all_play_losses: 0,
      all_play_ties: 0,
      points_for: 0,
      ...overrides
    })

    it('orders on head-to-head record first', function () {
      const better = team({
        regular_season_wins: 9,
        regular_season_losses: 5,
        all_play_wins: 40,
        all_play_losses: 86
      })
      const worse = team({
        regular_season_wins: 8,
        regular_season_losses: 6,
        all_play_wins: 90,
        all_play_losses: 36
      })
      expect(compare_playoff_seed(better, worse)).to.be.below(0)
    })

    it('breaks a record tie on all play before points for', function () {
      const a = team({
        regular_season_wins: 8,
        regular_season_losses: 6,
        all_play_wins: 70,
        all_play_losses: 56,
        points_for: 100
      })
      const b = team({
        regular_season_wins: 8,
        regular_season_losses: 6,
        all_play_wins: 60,
        all_play_losses: 66,
        points_for: 900
      })
      expect(compare_playoff_seed(a, b)).to.be.below(0)
    })

    it('breaks a full record and all play tie on points for', function () {
      const a = team({
        regular_season_wins: 8,
        regular_season_losses: 6,
        all_play_wins: 70,
        all_play_losses: 56,
        points_for: 900
      })
      const b = team({
        regular_season_wins: 8,
        regular_season_losses: 6,
        all_play_wins: 70,
        all_play_losses: 56,
        points_for: 100
      })
      expect(compare_playoff_seed(a, b)).to.be.below(0)
    })

    it('does not consult division standing', function () {
      const a = {
        ...team({ regular_season_wins: 5, regular_season_losses: 9 }),
        division: 1,
        division_finish: 1
      }
      const b = {
        ...team({ regular_season_wins: 9, regular_season_losses: 5 }),
        division: 2,
        division_finish: 3
      }
      expect(compare_playoff_seed(a, b)).to.be.above(0)
    })
  })

  describe('generate_fantasy_league_schedule', function () {
    const num_weeks = current_season.regularSeasonFinalWeek

    it('builds a full schedule for a 10-team single division', function () {
      const teams = make_teams(10, 1)
      const schedule = generate_fantasy_league_schedule(teams, 1234)

      expect(schedule.length).to.equal(num_weeks)
      for (const week of schedule) {
        expect(week.length).to.equal(5)
      }
    })

    it('has every 10-team single-division team play all nine opponents', function () {
      const teams = make_teams(10, 1)
      const schedule = generate_fantasy_league_schedule(teams, 1234)

      for (const { uid } of teams) {
        const counts = opponent_counts(schedule, uid)
        expect(Object.keys(counts).length).to.equal(9)
        expect(Object.values(counts).reduce((a, b) => a + b, 0)).to.equal(
          num_weeks
        )
        for (const count of Object.values(counts)) {
          expect(count).to.be.within(1, 2)
        }
      }
    })

    it('builds a full schedule for 12 teams across four divisions', function () {
      const teams = make_teams(12, 4)
      const schedule = generate_fantasy_league_schedule(teams, 1234)

      expect(schedule.length).to.equal(num_weeks)
      for (const week of schedule) {
        expect(week.length).to.equal(6)
      }
    })

    it('has each 4-division team play its divisional opponents twice', function () {
      const teams = make_teams(12, 4)
      const schedule = generate_fantasy_league_schedule(teams, 1234)

      for (const team of teams) {
        const counts = opponent_counts(schedule, team.uid)
        const division_opponents = teams.filter(
          (t) => t.division === team.division && t.uid !== team.uid
        )
        for (const opponent of division_opponents) {
          expect(counts[opponent.uid]).to.equal(2)
        }
      }
    })

    it('throws rather than returning an empty schedule for an unsupported count', function () {
      const teams = make_teams(9, 3)
      expect(() => generate_fantasy_league_schedule(teams, 1234)).to.throw(
        /Unsupported number of divisions/
      )
    })
  })
})
