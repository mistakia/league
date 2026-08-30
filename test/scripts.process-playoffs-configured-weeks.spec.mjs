/* global describe before after beforeEach it */
import * as chai from 'chai'
import MockDate from 'mockdate'
import dayjs from 'dayjs'

import knex from '#db'
import process_playoffs from '#scripts/process-playoffs.mjs'
import { current_season } from '#constants'
import season_dates from '#libs-shared/season-dates.mjs'
import league_fixture from '#db/fixtures/league.mjs'

process.env.NODE_ENV = 'test'

const expect = chai.expect

// process-playoffs is the only WRITER of `playoffs` matchup rows, and it used to
// hardcode weeks 15/16/17 while simulate-playoff-forecast resolved the league's
// configured weeks through get_season_playoff_weeks. A league on any other
// configuration therefore got its rows written at weeks it does not play, and
// the forecast -- looking at the configured weeks -- found none. Nothing threw
// and nothing logged; the forecast simply had no playoff field.
//
// The weeks below are deliberately NOT 15/16/17. A fixture on the hardcoded
// values cannot tell a writer that reads the config from one that ignores it,
// which is the whole failure: every value in the old code was correct for the
// default league and wrong for every other one.
const LEAGUE_ID = 1
const WILDCARD_WEEK = 14
const CHAMPIONSHIP_WEEKS = [15, 16]

// The ORDINALS are stable and stay literal in the writer -- 1 is the wildcard
// round and everything above it is the championship round, however many weeks
// that round spans. Only the week numbers are configuration. Asserting both
// together is what separates "wrote the right ordinal at the wrong week" from a
// genuine pass.
const WILDCARD_ORDINAL = 1
const FIRST_CHAMPIONSHIP_ORDINAL = 2

const DAY_SECONDS = 24 * 60 * 60

// current_season.week counts full weeks elapsed since regular_season_start, so
// N weeks and one day in is week N (cf. the derivation in
// leagues.head-to-head-berth-count.spec.mjs).
const pin_to_week = (week) =>
  MockDate.set(
    dayjs
      .unix(season_dates.regular_season_start + (week * 7 + 1) * DAY_SECONDS)
      .toDate()
  )

const configure_playoff_weeks = async ({
  wildcard_round,
  championship_round
}) =>
  knex('seasons')
    .update({ wildcard_round, championship_round })
    .where({ lid: LEAGUE_ID, season_year: current_season.year })

// Six teams in the field. The wildcard round takes regular season finishes 3
// through 6; 1 and 2 hold the byes and enter in the championship round.
const seed_seasonlogs = async () => {
  const rows = [1, 2, 3, 4, 5, 6].map((finish) => ({
    lid: LEAGUE_ID,
    tid: finish,
    season_year: current_season.year,
    regular_season_finish: finish,
    overall_finish: finish
  }))

  await knex('league_team_seasonlogs')
    .insert(rows)
    .onConflict(['tid', 'season_year'])
    .merge()
}

// Distinct points per team so the "two highest scoring wildcard teams advance"
// sort has a single correct answer. Teams 3 and 4 advance.
const wildcard_points_by_tid = { 3: 120, 4: 110, 5: 90, 6: 80 }

const seed_wildcard_results = async ({ week }) => {
  const rows = Object.entries(wildcard_points_by_tid).map(([tid, points]) => ({
    playoff_week_number: WILDCARD_ORDINAL,
    tid: Number(tid),
    lid: LEAGUE_ID,
    season_year: current_season.year,
    week,
    points
  }))

  await knex('playoffs').insert(rows)
}

const read_playoffs = () =>
  knex('playoffs')
    .where({ lid: LEAGUE_ID, season_year: current_season.year })
    .orderBy(['playoff_week_number', 'tid'])

describe('SCRIPTS process-playoffs configured playoff weeks', function () {
  this.timeout(60 * 1000)

  before(async function () {
    await knex.seed.run()
  })

  beforeEach(async function () {
    await league_fixture(knex)
    await knex('playoffs').del()
    await seed_seasonlogs()
  })

  after(function () {
    MockDate.reset()
  })

  it('writes the wildcard round at the configured week', async function () {
    await configure_playoff_weeks({
      wildcard_round: WILDCARD_WEEK,
      championship_round: CHAMPIONSHIP_WEEKS
    })
    pin_to_week(WILDCARD_WEEK)

    await process_playoffs({ lid: LEAGUE_ID, year: current_season.year })

    const playoffs = await read_playoffs()

    expect(playoffs.length).to.equal(4)
    for (const row of playoffs) {
      expect(row.week).to.equal(WILDCARD_WEEK)
      expect(row.playoff_week_number).to.equal(WILDCARD_ORDINAL)
    }
    expect(playoffs.map((row) => row.tid)).to.eql([3, 4, 5, 6])
  })

  it('writes one championship row per configured championship week', async function () {
    await configure_playoff_weeks({
      wildcard_round: WILDCARD_WEEK,
      championship_round: CHAMPIONSHIP_WEEKS
    })
    await seed_wildcard_results({ week: WILDCARD_WEEK })
    pin_to_week(CHAMPIONSHIP_WEEKS[0])

    await process_playoffs({ lid: LEAGUE_ID, year: current_season.year })

    const championship_rows = (await read_playoffs()).filter(
      (row) => row.playoff_week_number > WILDCARD_ORDINAL
    )

    // Byes (1, 2) plus the two highest scoring wildcard teams (3, 4), one row
    // per championship week.
    const expected_tids = [1, 2, 3, 4]
    expect(championship_rows.length).to.equal(
      expected_tids.length * CHAMPIONSHIP_WEEKS.length
    )

    CHAMPIONSHIP_WEEKS.forEach((championship_week, index) => {
      const ordinal = FIRST_CHAMPIONSHIP_ORDINAL + index
      const rows_for_ordinal = championship_rows.filter(
        (row) => row.playoff_week_number === ordinal
      )

      expect(rows_for_ordinal.map((row) => row.tid)).to.eql(expected_tids)
      for (const row of rows_for_ordinal) {
        expect(row.week).to.equal(championship_week)
      }
    })
  })

  it('extends the ordinals to a championship round of any length', async function () {
    // The old writer hand-wrote exactly two championship inserts, which made a
    // two-week round structural. A third week must produce ordinal 4, not a
    // dropped row.
    const three_week_round = [15, 16, 17]

    await configure_playoff_weeks({
      wildcard_round: WILDCARD_WEEK,
      championship_round: three_week_round
    })
    await seed_wildcard_results({ week: WILDCARD_WEEK })
    pin_to_week(three_week_round[0])

    await process_playoffs({ lid: LEAGUE_ID, year: current_season.year })

    const championship_rows = (await read_playoffs()).filter(
      (row) => row.playoff_week_number > WILDCARD_ORDINAL
    )

    expect(championship_rows.length).to.equal(4 * three_week_round.length)

    three_week_round.forEach((championship_week, index) => {
      const rows_for_ordinal = championship_rows.filter(
        (row) => row.playoff_week_number === FIRST_CHAMPIONSHIP_ORDINAL + index
      )

      expect(rows_for_ordinal.length).to.equal(4)
      for (const row of rows_for_ordinal) {
        expect(row.week).to.equal(championship_week)
      }
    })
  })

  it('throws for a current season with no playoff weeks configured', async function () {
    // An unconfigured current season has no week to write a row AT, and the old
    // code answered that by writing week 15 anyway. Refusing is the only other
    // honest option -- silently writing nothing would be the same shape as a
    // season that had nothing to do.
    await configure_playoff_weeks({
      wildcard_round: null,
      championship_round: null
    })
    pin_to_week(WILDCARD_WEEK)

    let error
    try {
      await process_playoffs({ lid: LEAGUE_ID, year: current_season.year })
    } catch (err) {
      error = err
    }

    expect(error, 'expected a throw for an unconfigured season').to.exist
    expect(error.message).to.include('No playoff weeks configured')
  })
})
