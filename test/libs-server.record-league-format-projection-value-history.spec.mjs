/* global describe before beforeEach it */
import * as chai from 'chai'

import knex from '#db'
import { record_league_format_projection_value_history } from '#libs-server'

import league from '#db/fixtures/league.mjs'

process.env.NODE_ENV = 'test'
const expect = chai.expect
chai.should()

const HISTORY_TABLE = 'league_format_player_projection_values_history'
const YEAR = 2026

// Point-in-time read the store exists to serve: latest observation at or before D.
const read_as_of = async ({ league_format_id, observed_at }) =>
  knex(HISTORY_TABLE)
    .distinctOn('pid', 'week')
    .select('pid', 'week', 'pts_added', 'market_salary', 'removed')
    .where({ league_format_id, year: YEAR })
    .where('observed_at', '<=', observed_at)
    .orderBy([
      { column: 'pid' },
      { column: 'week' },
      { column: 'observed_at', order: 'desc' }
    ])

describe('LIBS SERVER record_league_format_projection_value_history', function () {
  this.timeout(60 * 1000)

  let league_format_id

  before(async function () {
    await knex.seed.run()
    // The league fixture is what populates league_formats; the history table
    // carries an FK to it.
    await league(knex)
    const format_row = await knex('league_formats').select('id').first()
    league_format_id = format_row.id
  })

  beforeEach(async function () {
    await knex(HISTORY_TABLE).where({ league_format_id, year: YEAR }).del()
  })

  it('records an observation for every grain on first run', async () => {
    const observed_at = new Date('2026-07-01T04:00:00Z')
    const result = await record_league_format_projection_value_history({
      league_format_id,
      year: YEAR,
      observed_at,
      value_rows: [
        {
          pid: 'PATR-MAHO-005785',
          week: '0',
          pts_added: 42.5,
          market_salary: 31
        },
        {
          pid: 'PATR-MAHO-005785',
          week: '1',
          pts_added: 2.25,
          market_salary: 4
        }
      ]
    })

    expect(result.observed).to.equal(2)
    expect(result.changed).to.equal(2)
    expect(result.tombstoned).to.equal(0)

    const rows = await knex(HISTORY_TABLE).where({
      league_format_id,
      year: YEAR
    })
    expect(rows.length).to.equal(2)
  })

  it('writes nothing when values are unchanged', async () => {
    const value_rows = [
      { pid: 'PATR-MAHO-005785', week: '0', pts_added: 42.5, market_salary: 31 }
    ]

    await record_league_format_projection_value_history({
      league_format_id,
      year: YEAR,
      value_rows,
      observed_at: new Date('2026-07-01T04:00:00Z')
    })

    // Same values an hour later -- the hourly cron case. This is the property the
    // whole cost model rests on: an unchanged recompute must not append a row.
    const result = await record_league_format_projection_value_history({
      league_format_id,
      year: YEAR,
      value_rows,
      observed_at: new Date('2026-07-01T05:00:00Z')
    })

    expect(result.changed).to.equal(0)
    const rows = await knex(HISTORY_TABLE).where({
      league_format_id,
      year: YEAR
    })
    expect(rows.length).to.equal(1)
  })

  it('treats a float that rounds to the stored scale as unchanged', async () => {
    // pts_added is numeric(7,2); 42.499 is stored as 42.50 and must not read back
    // as a change on the next run.
    await record_league_format_projection_value_history({
      league_format_id,
      year: YEAR,
      value_rows: [
        {
          pid: 'PATR-MAHO-005785',
          week: '0',
          pts_added: 42.5,
          market_salary: 31
        }
      ],
      observed_at: new Date('2026-07-01T04:00:00Z')
    })

    const result = await record_league_format_projection_value_history({
      league_format_id,
      year: YEAR,
      value_rows: [
        {
          pid: 'PATR-MAHO-005785',
          week: '0',
          pts_added: 42.499,
          market_salary: 31
        }
      ],
      observed_at: new Date('2026-07-01T05:00:00Z')
    })

    expect(result.changed).to.equal(0)
  })

  it('appends only the grains that actually changed', async () => {
    await record_league_format_projection_value_history({
      league_format_id,
      year: YEAR,
      value_rows: [
        {
          pid: 'PATR-MAHO-005785',
          week: '0',
          pts_added: 42.5,
          market_salary: 31
        },
        { pid: 'JOSH-ALLE-005788', week: '0', pts_added: 40, market_salary: 29 }
      ],
      observed_at: new Date('2026-07-01T04:00:00Z')
    })

    const result = await record_league_format_projection_value_history({
      league_format_id,
      year: YEAR,
      value_rows: [
        {
          pid: 'PATR-MAHO-005785',
          week: '0',
          pts_added: 44,
          market_salary: 33
        },
        { pid: 'JOSH-ALLE-005788', week: '0', pts_added: 40, market_salary: 29 }
      ],
      observed_at: new Date('2026-07-02T04:00:00Z')
    })

    expect(result.changed).to.equal(1)
    const rows = await knex(HISTORY_TABLE).where({
      league_format_id,
      year: YEAR
    })
    expect(rows.length).to.equal(3)
  })

  it('resolves a point-in-time read to the value known on that date', async () => {
    await record_league_format_projection_value_history({
      league_format_id,
      year: YEAR,
      value_rows: [
        {
          pid: 'PATR-MAHO-005785',
          week: '0',
          pts_added: 42.5,
          market_salary: 31
        }
      ],
      observed_at: new Date('2026-07-01T04:00:00Z')
    })
    await record_league_format_projection_value_history({
      league_format_id,
      year: YEAR,
      value_rows: [
        { pid: 'PATR-MAHO-005785', week: '0', pts_added: 44, market_salary: 33 }
      ],
      observed_at: new Date('2026-07-10T04:00:00Z')
    })

    const early = await read_as_of({
      league_format_id,
      observed_at: new Date('2026-07-05T00:00:00Z')
    })
    expect(early.length).to.equal(1)
    expect(Number(early[0].market_salary)).to.equal(31)

    const late = await read_as_of({
      league_format_id,
      observed_at: new Date('2026-07-15T00:00:00Z')
    })
    expect(Number(late[0].market_salary)).to.equal(33)

    // Before any observation existed, the backtest must see nothing rather than
    // the earliest known value.
    const before_any = await read_as_of({
      league_format_id,
      observed_at: new Date('2026-06-01T00:00:00Z')
    })
    expect(before_any.length).to.equal(0)
  })

  it('tombstones a grain that drops out of the computed grid', async () => {
    await record_league_format_projection_value_history({
      league_format_id,
      year: YEAR,
      value_rows: [
        {
          pid: 'PATR-MAHO-005785',
          week: '0',
          pts_added: 42.5,
          market_salary: 31
        },
        { pid: 'JOSH-ALLE-005788', week: '0', pts_added: 40, market_salary: 29 }
      ],
      observed_at: new Date('2026-07-01T04:00:00Z')
    })

    const result = await record_league_format_projection_value_history({
      league_format_id,
      year: YEAR,
      value_rows: [
        {
          pid: 'PATR-MAHO-005785',
          week: '0',
          pts_added: 42.5,
          market_salary: 31
        }
      ],
      observed_at: new Date('2026-07-02T04:00:00Z')
    })

    expect(result.changed).to.equal(0)
    expect(result.tombstoned).to.equal(1)

    // The dropped player must not report a stale salary after the drop date --
    // this is the leakage the tombstone exists to prevent.
    const as_of = await read_as_of({
      league_format_id,
      observed_at: new Date('2026-07-05T00:00:00Z')
    })
    const dropped = as_of.find((row) => row.pid === 'JOSH-ALLE-005788')
    expect(dropped.removed).to.equal(true)
    expect(dropped.market_salary).to.equal(null)
  })

  it('does not re-tombstone an already-removed grain', async () => {
    await record_league_format_projection_value_history({
      league_format_id,
      year: YEAR,
      value_rows: [
        { pid: 'JOSH-ALLE-005788', week: '0', pts_added: 40, market_salary: 29 }
      ],
      observed_at: new Date('2026-07-01T04:00:00Z')
    })
    await record_league_format_projection_value_history({
      league_format_id,
      year: YEAR,
      value_rows: [],
      observed_at: new Date('2026-07-02T04:00:00Z')
    })

    const result = await record_league_format_projection_value_history({
      league_format_id,
      year: YEAR,
      value_rows: [],
      observed_at: new Date('2026-07-03T04:00:00Z')
    })

    expect(result.tombstoned).to.equal(0)
    const rows = await knex(HISTORY_TABLE).where({
      league_format_id,
      year: YEAR
    })
    expect(rows.length).to.equal(2)
  })

  it('records a grain returning after removal', async () => {
    await record_league_format_projection_value_history({
      league_format_id,
      year: YEAR,
      value_rows: [
        { pid: 'JOSH-ALLE-005788', week: '0', pts_added: 40, market_salary: 29 }
      ],
      observed_at: new Date('2026-07-01T04:00:00Z')
    })
    await record_league_format_projection_value_history({
      league_format_id,
      year: YEAR,
      value_rows: [],
      observed_at: new Date('2026-07-02T04:00:00Z')
    })

    // Same values as before the removal. A naive value-only comparison against the
    // last non-removed row would suppress this, leaving the grain tombstoned forever.
    const result = await record_league_format_projection_value_history({
      league_format_id,
      year: YEAR,
      value_rows: [
        { pid: 'JOSH-ALLE-005788', week: '0', pts_added: 40, market_salary: 29 }
      ],
      observed_at: new Date('2026-07-03T04:00:00Z')
    })

    expect(result.changed).to.equal(1)
    const as_of = await read_as_of({
      league_format_id,
      observed_at: new Date('2026-07-04T00:00:00Z')
    })
    expect(as_of[0].removed).to.equal(false)
    expect(Number(as_of[0].market_salary)).to.equal(29)
  })

  it('handles a null market_salary without churning', async () => {
    // Non-auction formats (pricing_model !== 'auction') write market_salary null.
    const value_rows = [
      {
        pid: 'PATR-MAHO-005785',
        week: '0',
        pts_added: 42.5,
        market_salary: null
      }
    ]

    await record_league_format_projection_value_history({
      league_format_id,
      year: YEAR,
      value_rows,
      observed_at: new Date('2026-07-01T04:00:00Z')
    })
    const result = await record_league_format_projection_value_history({
      league_format_id,
      year: YEAR,
      value_rows,
      observed_at: new Date('2026-07-02T04:00:00Z')
    })

    expect(result.changed).to.equal(0)
  })
})
