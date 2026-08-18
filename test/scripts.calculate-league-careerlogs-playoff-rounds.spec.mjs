/* global describe before beforeEach it */
import * as chai from 'chai'

import knex from '#db'
import calculate_league_careerlogs from '#scripts/calculate-league-careerlogs.mjs'

process.env.NODE_ENV = 'test'

const expect = chai.expect

// `playoffs.playoff_week_number` is an ORDINAL, not a key, and its meaning has
// never lived anywhere a machine can read: `1` is the wildcard round, and BOTH
// `2` and `3` are the championship round. That is stated only in comments in
// scripts/process-playoffs.mjs and in four filter expressions scattered across
// three files -- so a rename of the column, or a reasonable-looking "fix" that
// maps 2 and 3 onto separate rounds, changes what the league's career records
// mean with nothing to object.
//
// It is also why the column is NOT called `playoff_round`. That name reads as
// correct and is a second wrong one, because it implies 2 and 3 are different
// rounds. Renaming it was the moment to pin the semantics, which is what this
// spec is for.
//
// `calculate_league_careerlogs` is the consumer that reads the ordinal
// semantically rather than as an opaque key, so it is the one place where a
// transposition changes an OUTPUT rather than just an ordering. It buckets
// points three ways off the ordinal: wildcard totals from `1`, championship
// totals from `2` and `3` together, and a wildcard WIN inferred from the team
// having any championship-round row at all.
//
// FIXTURE SHAPE IS LOAD-BEARING. Every playoff row carries a DIFFERENT points
// value, and the two championship rows differ from each other, because a
// fixture holding two rows at one value cannot detect a transposition between
// them -- the natural failure of a mechanical rename sweep across an ordinal.
// The three values are chosen so that no bucket's total can be reached by any
// other subset: 100 / 20 / 3 makes wildcard 100, championship 23, and every
// wrong grouping a distinct number.

const LEAGUE_ID = 1
const TEAM_ID = 1
const SEASON_YEAR = 2023

const WILDCARD_POINTS = 100
const CHAMPIONSHIP_FIRST_POINTS = 20
const CHAMPIONSHIP_SECOND_POINTS = 3

const seed_seasonlog = async () => {
  await knex('league_team_seasonlogs').insert({
    lid: LEAGUE_ID,
    tid: TEAM_ID,
    season_year: SEASON_YEAR,
    regular_season_wins: 9,
    regular_season_losses: 4,
    regular_season_ties: 0,
    all_play_wins: 100,
    all_play_losses: 43,
    all_play_ties: 0,
    points_for: 1500,
    points_against: 1400,
    point_differential: 100,
    potential_points: 1700,
    potential_wins: 10,
    potential_losses: 3,
    highest_weekly_score: 150,
    lowest_weekly_score: 80,
    weekly_high_scores: 2,
    regular_season_finish: 3,
    overall_finish: 2,
    division_finish: 2
  })
}

// `week` differs per row because the schema's primary key spans
// (playoff_week_number, tid, season_year, week) -- the two championship rows
// would collide otherwise.
const seed_playoffs = async ({
  wildcard_ordinal = 1,
  championship_ordinals = [2, 3]
} = {}) => {
  await knex('playoffs').insert([
    {
      playoff_week_number: wildcard_ordinal,
      tid: TEAM_ID,
      lid: LEAGUE_ID,
      season_year: SEASON_YEAR,
      week: 15,
      points: WILDCARD_POINTS
    },
    {
      playoff_week_number: championship_ordinals[0],
      tid: TEAM_ID,
      lid: LEAGUE_ID,
      season_year: SEASON_YEAR,
      week: 16,
      points: CHAMPIONSHIP_FIRST_POINTS
    },
    {
      playoff_week_number: championship_ordinals[1],
      tid: TEAM_ID,
      lid: LEAGUE_ID,
      season_year: SEASON_YEAR,
      week: 17,
      points: CHAMPIONSHIP_SECOND_POINTS
    }
  ])
}

const read_careerlog = async () =>
  knex('league_team_careerlogs').where({ lid: LEAGUE_ID, tid: TEAM_ID }).first()

describe('SCRIPTS calculate_league_careerlogs playoff rounds', function () {
  this.timeout(30 * 1000)

  before(async () => {
    await knex('league_team_careerlogs').del()
    await knex('league_user_careerlogs').del()
    await knex('league_team_seasonlogs').del()
    await knex('playoffs').del()
  })

  beforeEach(async () => {
    await knex('league_team_careerlogs').del()
    await knex('league_user_careerlogs').del()
    await knex('league_team_seasonlogs').del()
    await knex('playoffs').del()
  })

  it('reads ordinal 1 as the wildcard round', async () => {
    await seed_seasonlog()
    await seed_playoffs()

    await calculate_league_careerlogs({ lid: LEAGUE_ID })

    const careerlog = await read_careerlog()

    expect(Number(careerlog.wildcard_total_points)).to.equal(WILDCARD_POINTS)
    expect(Number(careerlog.wildcard_highest_score)).to.equal(WILDCARD_POINTS)
    expect(Number(careerlog.wildcard_lowest_score)).to.equal(WILDCARD_POINTS)
  })

  it('reads ordinals 2 and 3 as ONE championship round', async () => {
    await seed_seasonlog()
    await seed_playoffs()

    await calculate_league_careerlogs({ lid: LEAGUE_ID })

    const careerlog = await read_careerlog()

    // Both rows contribute, which is the whole claim: 2 and 3 are the same
    // round played over two weeks, not two rounds.
    expect(Number(careerlog.championship_total_points)).to.equal(
      CHAMPIONSHIP_FIRST_POINTS + CHAMPIONSHIP_SECOND_POINTS
    )
    expect(Number(careerlog.championship_highest_score)).to.equal(
      CHAMPIONSHIP_FIRST_POINTS
    )
    expect(Number(careerlog.championship_lowest_score)).to.equal(
      CHAMPIONSHIP_SECOND_POINTS
    )
  })

  it('infers a wildcard win from the team reaching the championship round', async () => {
    await seed_seasonlog()
    await seed_playoffs()

    await calculate_league_careerlogs({ lid: LEAGUE_ID })

    const careerlog = await read_careerlog()

    expect(careerlog.wildcard_wins).to.equal(1)
  })

  it('records no wildcard win for a team eliminated in the wildcard round', async () => {
    await seed_seasonlog()
    await knex('playoffs').insert({
      playoff_week_number: 1,
      tid: TEAM_ID,
      lid: LEAGUE_ID,
      season_year: SEASON_YEAR,
      week: 15,
      points: WILDCARD_POINTS
    })

    await calculate_league_careerlogs({ lid: LEAGUE_ID })

    const careerlog = await read_careerlog()

    expect(careerlog.wildcard_wins).to.equal(0)
    expect(Number(careerlog.wildcard_total_points)).to.equal(WILDCARD_POINTS)
    expect(Number(careerlog.championship_total_points)).to.equal(0)
  })

  // The mutation control. Coverage added AFTER a rename cannot go red at the
  // pre-rename revision -- it would fail there on a missing column, which
  // proves the schema moved and nothing else. So this mutates FORWARD instead:
  // it transposes the wildcard and championship ordinals, which is exactly what
  // a mechanical sweep across an ordinal produces, and asserts the buckets
  // swap. If the assertions above ever stop discriminating the two rounds, this
  // one goes green and says so.
  it('distinguishes the rounds -- a transposed fixture lands in the other buckets', async () => {
    await seed_seasonlog()
    await seed_playoffs({
      wildcard_ordinal: 2,
      championship_ordinals: [1, 3]
    })

    await calculate_league_careerlogs({ lid: LEAGUE_ID })

    const careerlog = await read_careerlog()

    // The 100-point row now carries ordinal 2, so it must score as
    // championship; the 20-point row carries ordinal 1 and must score as
    // wildcard. Reading either bucket at its untransposed value would mean the
    // ordinal is not being read at all.
    expect(Number(careerlog.wildcard_total_points)).to.equal(
      CHAMPIONSHIP_FIRST_POINTS
    )
    expect(Number(careerlog.championship_total_points)).to.equal(
      WILDCARD_POINTS + CHAMPIONSHIP_SECOND_POINTS
    )
  })
})
