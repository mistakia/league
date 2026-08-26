/* global describe before beforeEach it */
import * as chai from 'chai'

import knex from '#db'
import { record_league_format_projection_value_history } from '#libs-server'

import league from '#db/fixtures/league.mjs'

process.env.NODE_ENV = 'test'
const expect = chai.expect
chai.should()

const WEEK_TABLE = 'league_format_player_projection_values_history'
const REST_OF_SEASON_TABLE =
  'league_format_player_rest_of_season_projection_values_history'
const YEAR = 2026

const MAHOMES = 'PATR-MAHO-005785'
const ALLEN = 'JOSH-ALLE-005788'

// Point-in-time read the store exists to serve: latest observation at or before
// D. The two tables differ only in their grain -- the week table adds `week` --
// which is the whole of what the period split changed here.
const read_week_as_of = async ({ league_format_id, observed_at }) =>
  knex(WEEK_TABLE)
    .distinctOn('pid', 'week')
    .select(
      'pid',
      'week',
      'projected_points_added',
      'market_salary',
      'is_removed'
    )
    .where({ league_format_id, season_year: YEAR })
    .where('observed_at', '<=', observed_at)
    .orderBy([
      { column: 'pid' },
      { column: 'week' },
      { column: 'observed_at', order: 'desc' }
    ])

const read_rest_of_season_as_of = async ({ league_format_id, observed_at }) =>
  knex(REST_OF_SEASON_TABLE)
    .distinctOn('pid')
    .select(
      'pid',
      'projected_points_added_positive',
      'projected_points_added_net',
      'market_salary_positive',
      'market_salary_net',
      'is_removed'
    )
    .where({ league_format_id, season_year: YEAR })
    .where('observed_at', '<=', observed_at)
    .orderBy([{ column: 'pid' }, { column: 'observed_at', order: 'desc' }])

const week_row = (pid, week, projected_points_added, market_salary) => ({
  pid,
  week,
  projected_points_added,
  market_salary
})

const rest_of_season_row = (
  pid,
  positive,
  net,
  salary_positive,
  salary_net
) => ({
  pid,
  projected_points_added_positive: positive,
  projected_points_added_net: net,
  market_salary_positive: salary_positive,
  market_salary_net: salary_net
})

describe('LIBS SERVER record_league_format_projection_value_history', function () {
  this.timeout(60 * 1000)

  let league_format_id

  const record = ({
    weekly_value_rows = [],
    rest_of_season_value_rows = [],
    observed_at
  }) =>
    record_league_format_projection_value_history({
      league_format_id,
      year: YEAR,
      weekly_value_rows,
      rest_of_season_value_rows,
      observed_at
    })

  before(async function () {
    await knex.seed.run()
    // The league fixture is what populates league_formats; both history tables
    // carry an FK to it.
    await league(knex)
    const format_row = await knex('league_formats').select('id').first()
    league_format_id = format_row.id
  })

  beforeEach(async function () {
    for (const table of [WEEK_TABLE, REST_OF_SEASON_TABLE]) {
      await knex(table).where({ league_format_id, season_year: YEAR }).del()
    }
  })

  it('records an observation for every grain on first run', async () => {
    const observed_at = new Date('2026-07-01T04:00:00Z')
    const result = await record({
      observed_at,
      weekly_value_rows: [
        week_row(MAHOMES, '1', 2.25, 4),
        week_row(MAHOMES, '2', 3.5, 5)
      ],
      rest_of_season_value_rows: [
        rest_of_season_row(MAHOMES, 42.5, 38.25, 31, 29)
      ]
    })

    expect(result.weekly.observed).to.equal(2)
    expect(result.weekly.changed).to.equal(2)
    expect(result.weekly.tombstoned).to.equal(0)
    expect(result.rest_of_season.changed).to.equal(1)

    const week_rows = await knex(WEEK_TABLE).where({
      league_format_id,
      season_year: YEAR
    })
    expect(week_rows.length).to.equal(2)

    const period_rows = await knex(REST_OF_SEASON_TABLE).where({
      league_format_id,
      season_year: YEAR
    })
    expect(period_rows.length).to.equal(1)
  })

  it('writes nothing when values are unchanged', async () => {
    const weekly_value_rows = [week_row(MAHOMES, '1', 2.25, 4)]
    const rest_of_season_value_rows = [
      rest_of_season_row(MAHOMES, 42.5, 38.25, 31, 29)
    ]

    await record({
      weekly_value_rows,
      rest_of_season_value_rows,
      observed_at: new Date('2026-07-01T04:00:00Z')
    })

    // Same values an hour later -- the hourly cron case. This is the property the
    // whole cost model rests on: an unchanged recompute must not append a row.
    const result = await record({
      weekly_value_rows,
      rest_of_season_value_rows,
      observed_at: new Date('2026-07-01T05:00:00Z')
    })

    expect(result.weekly.changed).to.equal(0)
    expect(result.rest_of_season.changed).to.equal(0)

    const week_rows = await knex(WEEK_TABLE).where({
      league_format_id,
      season_year: YEAR
    })
    expect(week_rows.length).to.equal(1)
  })

  it('treats a float that rounds to the stored scale as unchanged', async () => {
    // Every value column is numeric with 2 decimal places; 42.499 is stored as
    // 42.50 and must not read back as a change on the next run.
    await record({
      rest_of_season_value_rows: [
        rest_of_season_row(MAHOMES, 42.5, 38.25, 31, 29)
      ],
      observed_at: new Date('2026-07-01T04:00:00Z')
    })

    const result = await record({
      rest_of_season_value_rows: [
        rest_of_season_row(MAHOMES, 42.499, 38.25, 31, 29)
      ],
      observed_at: new Date('2026-07-01T05:00:00Z')
    })

    expect(result.rest_of_season.changed).to.equal(0)
  })

  it('appends only the grains that actually changed', async () => {
    await record({
      weekly_value_rows: [
        week_row(MAHOMES, '1', 42.5, 31),
        week_row(ALLEN, '1', 40, 29)
      ],
      observed_at: new Date('2026-07-01T04:00:00Z')
    })

    const result = await record({
      weekly_value_rows: [
        week_row(MAHOMES, '1', 44, 33),
        week_row(ALLEN, '1', 40, 29)
      ],
      observed_at: new Date('2026-07-02T04:00:00Z')
    })

    expect(result.weekly.changed).to.equal(1)
    const rows = await knex(WEEK_TABLE).where({
      league_format_id,
      season_year: YEAR
    })
    expect(rows.length).to.equal(3)
  })

  it('resolves a point-in-time read to the value known on that date', async () => {
    await record({
      rest_of_season_value_rows: [
        rest_of_season_row(MAHOMES, 42.5, 38.25, 31, 29)
      ],
      observed_at: new Date('2026-07-01T04:00:00Z')
    })
    await record({
      rest_of_season_value_rows: [rest_of_season_row(MAHOMES, 44, 40, 33, 31)],
      observed_at: new Date('2026-07-10T04:00:00Z')
    })

    const early = await read_rest_of_season_as_of({
      league_format_id,
      observed_at: new Date('2026-07-05T00:00:00Z')
    })
    expect(early.length).to.equal(1)
    expect(Number(early[0].market_salary_positive)).to.equal(31)
    expect(Number(early[0].market_salary_net)).to.equal(29)

    const late = await read_rest_of_season_as_of({
      league_format_id,
      observed_at: new Date('2026-07-15T00:00:00Z')
    })
    expect(Number(late[0].market_salary_positive)).to.equal(33)

    // Before any observation existed, the backtest must see nothing rather than
    // the earliest known value.
    const before_any = await read_rest_of_season_as_of({
      league_format_id,
      observed_at: new Date('2026-06-01T00:00:00Z')
    })
    expect(before_any.length).to.equal(0)
  })

  // THE PERIOD SPLIT'S LOAD-BEARING PROPERTY. A grain dropping out of the
  // rest-of-season set must be tombstoned in the REST-OF-SEASON history, not in
  // the weekly one. Recording it against the wrong period leaves the real
  // period's last observation standing forever, which is exactly the
  // stale-value leakage this table was built to prevent -- and it is invisible
  // from either table alone, because each one looks internally consistent.
  it('tombstones a dropped grain in its OWN period, and only there', async () => {
    await record({
      weekly_value_rows: [
        week_row(MAHOMES, '1', 2.25, 4),
        week_row(ALLEN, '1', 1.5, 3)
      ],
      rest_of_season_value_rows: [
        rest_of_season_row(MAHOMES, 42.5, 38.25, 31, 29),
        rest_of_season_row(ALLEN, 40, 36, 29, 27)
      ],
      observed_at: new Date('2026-07-01T04:00:00Z')
    })

    // Allen leaves the rest-of-season set and STAYS in the weekly one.
    const result = await record({
      weekly_value_rows: [
        week_row(MAHOMES, '1', 2.25, 4),
        week_row(ALLEN, '1', 1.5, 3)
      ],
      rest_of_season_value_rows: [
        rest_of_season_row(MAHOMES, 42.5, 38.25, 31, 29)
      ],
      observed_at: new Date('2026-07-02T04:00:00Z')
    })

    expect(result.weekly.tombstoned).to.equal(0)
    expect(result.rest_of_season.tombstoned).to.equal(1)

    const rest_of_season = await read_rest_of_season_as_of({
      league_format_id,
      observed_at: new Date('2026-07-05T00:00:00Z')
    })
    const dropped = rest_of_season.find((row) => row.pid === ALLEN)
    expect(dropped.is_removed).to.equal(true)
    expect(dropped.market_salary_positive).to.equal(null)
    expect(dropped.market_salary_net).to.equal(null)

    // The weekly observation is untouched: he did not drop out of THAT period.
    const weekly = await read_week_as_of({
      league_format_id,
      observed_at: new Date('2026-07-05T00:00:00Z')
    })
    const still_weekly = weekly.find((row) => row.pid === ALLEN)
    expect(still_weekly.is_removed).to.equal(false)
    expect(Number(still_weekly.market_salary)).to.equal(3)
  })

  it('does not re-tombstone an already-removed grain', async () => {
    await record({
      weekly_value_rows: [week_row(ALLEN, '1', 40, 29)],
      observed_at: new Date('2026-07-01T04:00:00Z')
    })
    await record({ observed_at: new Date('2026-07-02T04:00:00Z') })

    const result = await record({
      observed_at: new Date('2026-07-03T04:00:00Z')
    })

    expect(result.weekly.tombstoned).to.equal(0)
    const rows = await knex(WEEK_TABLE).where({
      league_format_id,
      season_year: YEAR
    })
    expect(rows.length).to.equal(2)
  })

  it('records a grain returning after removal', async () => {
    await record({
      weekly_value_rows: [week_row(ALLEN, '1', 40, 29)],
      observed_at: new Date('2026-07-01T04:00:00Z')
    })
    await record({ observed_at: new Date('2026-07-02T04:00:00Z') })

    // Same values as before the removal. A naive value-only comparison against the
    // last non-removed row would suppress this, leaving the grain tombstoned forever.
    const result = await record({
      weekly_value_rows: [week_row(ALLEN, '1', 40, 29)],
      observed_at: new Date('2026-07-03T04:00:00Z')
    })

    expect(result.weekly.changed).to.equal(1)
    const as_of = await read_week_as_of({
      league_format_id,
      observed_at: new Date('2026-07-04T00:00:00Z')
    })
    expect(as_of[0].is_removed).to.equal(false)
    expect(Number(as_of[0].market_salary)).to.equal(29)
  })

  it('handles a null market_salary without churning', async () => {
    // Non-auction formats (pricing_model !== 'auction') write market_salary null.
    const weekly_value_rows = [week_row(MAHOMES, '1', 42.5, null)]

    await record({
      weekly_value_rows,
      observed_at: new Date('2026-07-01T04:00:00Z')
    })
    const result = await record({
      weekly_value_rows,
      observed_at: new Date('2026-07-02T04:00:00Z')
    })

    expect(result.weekly.changed).to.equal(0)
  })
})
