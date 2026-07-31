/* global describe before it */

import * as chai from 'chai'

import db from '#db'
import {
  MERGE_COLUMNS_FULL,
  MERGE_COLUMNS_FULL_RDP,
  MERGE_COLUMNS_DAILY,
  merge_columns_for_branch,
  create_valuation_accumulator,
  parse_keeptradecut_date
} from '#scripts/import-keeptradecut.mjs'
import { ktc_at } from '#libs-server/roster-asset-lineage/compute-snapshots-bulk.mjs'

chai.should()
const expect = chai.expect

const OBSERVED_AT = new Date('2025-09-08T04:00:00Z')
const PLAYER_PID = 'TEST-KTCV-000001'
const PICK_PID = 'KTCPICK-9990001'

// Writes one player's assembled batch exactly as importKeepTradeCut does:
// conflict target on the full key, merging only the columns the branch owns.
const write_batch = ({ rows, merge_columns }) =>
  db('keeptradecut_valuations')
    .insert(rows)
    .onConflict(['pid', 'is_superflex', 'observed_at'])
    .merge(merge_columns)

const build_rows = ({ pid, merge_columns, metrics }) => {
  const accumulator = create_valuation_accumulator({ pid, merge_columns })
  for (const [column, value] of Object.entries(metrics)) {
    accumulator.add({
      is_superflex: true,
      observed_at: OBSERVED_AT,
      column,
      value
    })
  }
  return accumulator.complete_rows()
}

const read_row = (pid) =>
  db('keeptradecut_valuations')
    .where({ pid, is_superflex: true, observed_at: OBSERVED_AT })
    .first()

describe('SCRIPTS import-keeptradecut valuations', function () {
  describe('merge_columns_for_branch', function () {
    it('gives each importer branch exactly the columns it scrapes', () => {
      merge_columns_for_branch({
        full: false,
        is_rdp: false
      }).should.deep.equal(MERGE_COLUMNS_DAILY)
      merge_columns_for_branch({ full: false, is_rdp: true }).should.deep.equal(
        MERGE_COLUMNS_DAILY
      )
      merge_columns_for_branch({ full: true, is_rdp: true }).should.deep.equal(
        MERGE_COLUMNS_FULL_RDP
      )
      merge_columns_for_branch({ full: true, is_rdp: false }).should.deep.equal(
        MERGE_COLUMNS_FULL
      )
      // The whole point of three lists rather than two: the pick page carries
      // no positionalRankHistory, so an RDP branch must never name that column.
      MERGE_COLUMNS_FULL_RDP.should.not.include('position_rank')
      MERGE_COLUMNS_DAILY.should.not.include('position_rank')
      MERGE_COLUMNS_DAILY.should.not.include('overall_rank')
    })
  })

  describe('parse_keeptradecut_date', function () {
    it('yields the local-midnight instant the integer epoch column encoded', () => {
      // The suite and production both run TZ=America/New_York, and dayjs parses
      // a bare YYYY-MM-DD at LOCAL midnight. Retyping `d` to observed_at is a
      // unit change only because that is preserved -- a parse landing on UTC
      // midnight would shift every observation four or five hours.
      const parsed = parse_keeptradecut_date('2309071234')
      parsed.should.be.an.instanceof(Date)
      parsed.toISOString().should.equal('2023-09-07T04:00:00.000Z')
      // January, on the other side of DST, is five hours off UTC.
      parse_keeptradecut_date('2401150999')
        .toISOString()
        .should.equal('2024-01-15T05:00:00.000Z')
    })
  })

  describe('accumulator', function () {
    it('collapses independent metric arrays into one wide row per instant', () => {
      const { rows, skipped } = build_rows({
        pid: PLAYER_PID,
        merge_columns: MERGE_COLUMNS_FULL,
        metrics: {
          keeptradecut_value: 6543,
          position_rank: 4,
          overall_rank: 11
        }
      })
      skipped.should.equal(0)
      rows.should.have.length(1)
      rows[0].should.deep.equal({
        pid: PLAYER_PID,
        is_superflex: true,
        observed_at: OBSERVED_AT,
        keeptradecut_value: 6543,
        position_rank: 4,
        overall_rank: 11
      })
    })

    it('skips a rank whose instant carries no value and counts the shortfall', () => {
      const accumulator = create_valuation_accumulator({
        pid: PLAYER_PID,
        merge_columns: MERGE_COLUMNS_FULL
      })
      // A rank on an instant the value array never reported -- the shape that
      // would otherwise throw 23502 and abort the whole player's batch.
      accumulator.add({
        is_superflex: true,
        observed_at: new Date('2025-09-07T04:00:00Z'),
        column: 'overall_rank',
        value: 12
      })
      accumulator.add({
        is_superflex: true,
        observed_at: OBSERVED_AT,
        column: 'keeptradecut_value',
        value: 6543
      })

      const { rows, skipped } = accumulator.complete_rows()
      skipped.should.equal(1)
      rows.should.have.length(1)
      rows[0].observed_at.should.eql(OBSERVED_AT)
    })
  })

  describe('branch-matched upsert', function () {
    before(async () => {
      await db('keeptradecut_valuations')
        .whereIn('pid', [PLAYER_PID, PICK_PID])
        .del()
    })

    it('leaves both ranks intact when a daily batch follows a full batch', async () => {
      const full = build_rows({
        pid: PLAYER_PID,
        merge_columns: MERGE_COLUMNS_FULL,
        metrics: {
          keeptradecut_value: 6543,
          position_rank: 4,
          overall_rank: 11
        }
      })
      await write_batch({
        rows: full.rows,
        merge_columns: MERGE_COLUMNS_FULL
      })

      const daily = build_rows({
        pid: PLAYER_PID,
        merge_columns: MERGE_COLUMNS_DAILY,
        metrics: { keeptradecut_value: 6600 }
      })
      await write_batch({
        rows: daily.rows,
        merge_columns: MERGE_COLUMNS_DAILY
      })

      const row = await read_row(PLAYER_PID)
      row.keeptradecut_value.should.equal(6600)
      row.position_rank.should.equal(4)
      row.overall_rank.should.equal(11)
    })

    it('does not null a position rank when an RDP batch follows a full batch', async () => {
      const full = build_rows({
        pid: PICK_PID,
        merge_columns: MERGE_COLUMNS_FULL,
        metrics: {
          keeptradecut_value: 3200,
          position_rank: 7,
          overall_rank: 90
        }
      })
      await write_batch({
        rows: full.rows,
        merge_columns: MERGE_COLUMNS_FULL
      })

      // The RDP branch never assembles a position_rank, so the row it presents
      // has no such key AND its merge list does not name the column.
      const rdp = build_rows({
        pid: PICK_PID,
        merge_columns: MERGE_COLUMNS_FULL_RDP,
        metrics: { keeptradecut_value: 3300, overall_rank: 88 }
      })
      expect(rdp.rows[0]).to.not.have.property('position_rank')
      await write_batch({
        rows: rdp.rows,
        merge_columns: MERGE_COLUMNS_FULL_RDP
      })

      const row = await read_row(PICK_PID)
      row.keeptradecut_value.should.equal(3300)
      row.overall_rank.should.equal(88)
      row.position_rank.should.equal(7)
    })
  })

  // ktc_at consumes the same feed on the read side. Its rows are normalised to
  // epoch seconds at load precisely because observed_at returns as a JS Date,
  // and `Date <= number` coerces to milliseconds and is silently always false.
  describe('ktc_at', function () {
    const rows = [
      { d: Math.floor(Date.UTC(2024, 0, 1) / 1000), v: 100 },
      { d: Math.floor(Date.UTC(2024, 5, 1) / 1000), v: 200 },
      { d: Math.floor(Date.UTC(2024, 11, 1) / 1000), v: 300 }
    ]
    const idx = { ktc: new Map([[PLAYER_PID, rows]]) }

    it('returns the latest value at or before the target instant', () => {
      ktc_at(
        idx,
        PLAYER_PID,
        Math.floor(Date.UTC(2024, 7, 15) / 1000)
      ).should.equal(200)
      ktc_at(
        idx,
        PLAYER_PID,
        Math.floor(Date.UTC(2025, 0, 1) / 1000)
      ).should.equal(300)
      ktc_at(idx, PLAYER_PID, rows[0].d).should.equal(100)
    })

    it('does not fall through to the earliest observation after the series starts', () => {
      // The retype's silent failure mode: a Date/number comparison makes every
      // `r.d <= target` false, so every asset reads rows[0] -- the earliest KTC
      // value ever recorded -- and nothing errors.
      const target = Math.floor(Date.UTC(2024, 11, 31) / 1000)
      ktc_at(idx, PLAYER_PID, target).should.not.equal(rows[0].v)
      ktc_at(idx, PLAYER_PID, target).should.equal(300)
    })

    it('returns null for an unknown pid', () => {
      expect(ktc_at(idx, 'TEST-KTCV-999999', rows[0].d)).to.equal(null)
    })
  })
})
