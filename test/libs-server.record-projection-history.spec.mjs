/* global describe, before, beforeEach, after, it */
import * as chai from 'chai'

import db from '#db'
import record_projection_history from '#libs-server/record-projection-history.mjs'
import { projection_periods } from '#libs-server/save-projections.mjs'

process.env.NODE_ENV = 'test'
const expect = chai.expect

// This spec EXECUTES the writer against a real database rather than inspecting
// the payload it builds. That distinction is the whole point: a payload naming a
// column which does not exist is well-formed JavaScript, and `test/global.mjs`
// loads the same schema file the writer was written against, so a payload-shape
// assertion passes over a writer that cannot execute. Only the round trip tells
// those apart -- the class docs/guides/schema.md records for
// `generate-league-format-player-seasonlogs` and `generate-player-snaps`.
const SOURCE_ID = 990
const SEASON_YEAR = 2031
const PID = 'TEST-SEAS-099001'

const season_row = (overrides = {}) => ({
  pid: PID,
  source_id: SOURCE_ID,
  season_year: SEASON_YEAR,
  passing_yards: 4000.0,
  passing_touchdowns: 30.0,
  rushing_yards: 210.5,
  receiving_yards: 0.0,
  field_goal_yards: 0,
  ...overrides
})

const weekly_row = (overrides = {}) =>
  season_row({ user_id: 0, week: 3, season_type: 'REG', ...overrides })

const season_rows = () =>
  db('season_projections_history')
    .where({ source_id: SOURCE_ID, season_year: SEASON_YEAR })
    .orderBy('generated_at')

const weekly_rows = () =>
  db('projections_history')
    .where({ source_id: SOURCE_ID, season_year: SEASON_YEAR })
    .orderBy('generated_at')

const cleanup = async () => {
  await db('season_projections_history')
    .where({ source_id: SOURCE_ID, season_year: SEASON_YEAR })
    .del()
  await db('projections_history')
    .where({ source_id: SOURCE_ID, season_year: SEASON_YEAR })
    .del()
}

describe('LIBS-SERVER record_projection_history', function () {
  this.timeout(30000)

  before(cleanup)
  beforeEach(cleanup)
  after(cleanup)

  it('routes a season-period call to the season table and not the weekly one', async () => {
    await record_projection_history({
      inserts: [season_row()],
      period: projection_periods.SEASON,
      generated_at: new Date('2031-05-01T12:00:00Z')
    })

    const season = await season_rows()
    const weekly = await weekly_rows()

    expect(season).to.have.lengthOf(1)
    expect(weekly).to.have.lengthOf(0)
    // Assert a VALUE round-tripped, not merely that a row exists. A writer that
    // dropped every stat key would still produce one row here.
    expect(Number(season[0].passing_yards)).to.equal(4000)
    expect(Number(season[0].rushing_yards)).to.equal(210.5)
    expect(season[0].pid).to.equal(PID)
  })

  it('routes a week-period call to the weekly table and not the season one', async () => {
    await record_projection_history({
      inserts: [weekly_row()],
      period: projection_periods.WEEK,
      generated_at: new Date('2031-05-01T12:00:00Z')
    })

    const season = await season_rows()
    const weekly = await weekly_rows()

    expect(weekly).to.have.lengthOf(1)
    expect(weekly[0].week).to.equal(3)
    expect(season).to.have.lengthOf(0)
  })

  // Routing is STATED by the caller, not inferred from the rows. It used to be
  // read off `Number(row.week) === 0`, which a season row can no longer answer:
  // `season_projections_index` has no week column, so every season row would
  // have sniffed as weekly and the whole series would have gone to the wrong
  // table. A batch is therefore one period, and an unstated period is refused
  // rather than defaulted -- a default here would pick a table in silence.
  it('refuses a call that does not state its period', async () => {
    let error
    try {
      await record_projection_history({
        inserts: [season_row()],
        generated_at: new Date('2031-05-01T12:00:00Z')
      })
    } catch (err) {
      error = err
    }

    expect(error).to.be.an('error')
    expect(error.message).to.include('period')
    expect(await season_rows()).to.have.lengthOf(0)
    expect(await weekly_rows()).to.have.lengthOf(0)
  })

  describe('change-only storage', function () {
    it('records nothing on a re-run whose values are unchanged', async () => {
      await record_projection_history({
        inserts: [season_row()],
        period: projection_periods.SEASON,
        generated_at: new Date('2031-05-01T12:00:00Z')
      })
      const result = await record_projection_history({
        inserts: [season_row()],
        period: projection_periods.SEASON,
        generated_at: new Date('2031-05-01T13:00:00Z')
      })

      expect(await season_rows()).to.have.lengthOf(1)
      expect(result.season.observed).to.equal(1)
      expect(result.season.changed).to.equal(0)
    })

    it('records nothing when an unchanged value arrives at a different precision', async () => {
      // The normalization trap. The column is numeric(n,1), so 4000 and 4000.04
      // both STORE as 4000.0 -- if the comparison ran against the raw incoming
      // value rather than the value it rounds to, every run would read as a
      // change and the change-only store would degrade into a full snapshot.
      await record_projection_history({
        inserts: [season_row({ passing_yards: 4000 })],
        period: projection_periods.SEASON,
        generated_at: new Date('2031-05-01T12:00:00Z')
      })
      await record_projection_history({
        inserts: [season_row({ passing_yards: 4000.04 })],
        period: projection_periods.SEASON,
        generated_at: new Date('2031-05-01T13:00:00Z')
      })

      expect(await season_rows()).to.have.lengthOf(1)
    })

    it('records one row when a value moves, and keeps the earlier state', async () => {
      await record_projection_history({
        inserts: [season_row()],
        period: projection_periods.SEASON,
        generated_at: new Date('2031-05-01T12:00:00Z')
      })
      const result = await record_projection_history({
        inserts: [season_row({ passing_yards: 4100.0 })],
        period: projection_periods.SEASON,
        generated_at: new Date('2031-05-01T13:00:00Z')
      })

      const rows = await season_rows()
      expect(rows).to.have.lengthOf(2)
      expect(result.season.changed).to.equal(1)
      expect(rows.map((row) => Number(row.passing_yards))).to.deep.equal([
        4000, 4100
      ])
    })

    it('treats a value moving to NULL as a change', async () => {
      await record_projection_history({
        inserts: [season_row()],
        period: projection_periods.SEASON,
        generated_at: new Date('2031-05-01T12:00:00Z')
      })
      await record_projection_history({
        inserts: [season_row({ passing_yards: null })],
        period: projection_periods.SEASON,
        generated_at: new Date('2031-05-01T13:00:00Z')
      })

      const rows = await season_rows()
      expect(rows).to.have.lengthOf(2)
      expect(rows[1].passing_yards).to.equal(null)
    })

    it('compares the WHOLE stat tuple, not a leading subset', async () => {
      // A change detector reading the wrong column set collapses genuinely
      // distinct forecasts into one run. Move a column late in the tuple and
      // leave every earlier one alone -- a subset comparison reads this as
      // unchanged and stores nothing.
      await record_projection_history({
        inserts: [season_row()],
        period: projection_periods.SEASON,
        generated_at: new Date('2031-05-01T12:00:00Z')
      })
      await record_projection_history({
        inserts: [season_row({ punt_return_touchdowns: 1.0 })],
        period: projection_periods.SEASON,
        generated_at: new Date('2031-05-01T13:00:00Z')
      })

      expect(await season_rows()).to.have.lengthOf(2)
    })

    it('is idempotent when the same instant is recorded twice', async () => {
      const generated_at = new Date('2031-05-01T12:00:00Z')
      await record_projection_history({
        inserts: [season_row()],
        period: projection_periods.SEASON,
        generated_at
      })
      await record_projection_history({
        inserts: [season_row({ passing_yards: 4100.0 })],
        period: projection_periods.SEASON,
        generated_at
      })

      expect(await season_rows()).to.have.lengthOf(1)
    })

    it('does not apply change-only collapsing to the weekly table', async () => {
      // The weekly series is stored as-is, one row per importer run. Collapsing
      // it would be a behaviour change this cluster did not make.
      await record_projection_history({
        inserts: [weekly_row()],
        period: projection_periods.WEEK,
        generated_at: new Date('2031-05-01T12:00:00Z')
      })
      await record_projection_history({
        inserts: [weekly_row()],
        period: projection_periods.WEEK,
        generated_at: new Date('2031-05-01T13:00:00Z')
      })

      expect(await weekly_rows()).to.have.lengthOf(2)
    })
  })

  describe('rows the season table cannot represent', function () {
    // The season table has no season_type and no user_id column. Routing such a
    // row there would relabel it silently, so the writer refuses instead.
    it('throws on a season row that is not REG rather than dropping its season type', async () => {
      let error
      try {
        await record_projection_history({
          inserts: [season_row({ season_type: 'POST' })],
          period: projection_periods.SEASON,
          generated_at: new Date('2031-05-01T12:00:00Z')
        })
      } catch (err) {
        error = err
      }

      expect(error).to.be.an('error')
      expect(error.message).to.include('season_type')
      expect(await season_rows()).to.have.lengthOf(0)
    })

    it('throws on a season row carrying a user_id rather than dropping it', async () => {
      let error
      try {
        await record_projection_history({
          inserts: [season_row({ user_id: 7 })],
          period: projection_periods.SEASON,
          generated_at: new Date('2031-05-01T12:00:00Z')
        })
      } catch (err) {
        error = err
      }

      expect(error).to.be.an('error')
      expect(error.message).to.include('user_id')
      expect(await season_rows()).to.have.lengthOf(0)
    })

    it('leaves a non-REG numbered week alone -- it belongs in the weekly table', async () => {
      await record_projection_history({
        inserts: [weekly_row({ season_type: 'POST' })],
        period: projection_periods.WEEK,
        generated_at: new Date('2031-05-01T12:00:00Z')
      })

      const weekly = await weekly_rows()
      expect(weekly).to.have.lengthOf(1)
      expect(weekly[0].season_type).to.equal('POST')
    })
  })

  describe('required arguments', function () {
    it('throws without inserts', async () => {
      let error
      try {
        await record_projection_history({
          generated_at: new Date(),
          period: projection_periods.SEASON
        })
      } catch (err) {
        error = err
      }
      expect(error).to.be.an('error')
    })

    it('throws without generated_at', async () => {
      let error
      try {
        await record_projection_history({
          inserts: [],
          period: projection_periods.SEASON
        })
      } catch (err) {
        error = err
      }
      expect(error).to.be.an('error')
    })
  })
})
