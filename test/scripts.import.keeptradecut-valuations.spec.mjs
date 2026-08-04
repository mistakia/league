/* global describe before it beforeEach afterEach */

import * as chai from 'chai'
import dayjs from 'dayjs'

import db from '#db'
import league from '#db/fixtures/league.mjs'
import {
  MERGE_COLUMNS_FULL,
  MERGE_COLUMNS_FULL_RDP,
  MERGE_COLUMNS_DAILY,
  merge_columns_for_branch,
  create_valuation_accumulator,
  parse_keeptradecut_date,
  resolve_known_keeptradecut_player,
  compute_freshness_shortfalls
} from '#scripts/import-keeptradecut.mjs'
import compute_snapshots_bulk, {
  ktc_at
} from '#libs-server/roster-asset-lineage/compute-snapshots-bulk.mjs'
import { ASSET_TYPE } from '#libs-server/roster-asset-lineage/constants.mjs'

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

  // The dynasty-rankings page and the rankings POST endpoint are separate
  // fetches of separately-computed top-500 lists, so a player can be in the
  // POST payload and absent from the page. Reading `.position` off that absent
  // record threw a TypeError and killed the whole 2026-08-02 run mid-import.
  // Resolving the vendor id against what we already know is what lets those
  // players import instead of taking the process down.
  describe('resolve_known_keeptradecut_player', function () {
    const KNOWN_PICK_KTC_ID = 9990002
    const KNOWN_PLAYER_KTC_ID = 9990003
    const KNOWN_PLAYER_PID = 'TEST-KTCR-000001'

    before(async () => {
      await db('keeptradecut_pick')
        .where('ktc_player_id', KNOWN_PICK_KTC_ID)
        .del()
      await db('player').where('pid', KNOWN_PLAYER_PID).del()

      const now = new Date()
      await db('keeptradecut_pick').insert({
        pid: `KTCPICK-${KNOWN_PICK_KTC_ID}`,
        ktc_player_id: KNOWN_PICK_KTC_ID,
        ktc_player_name: '2027 Mid 1st',
        season_year: 2027,
        round: 1,
        slot: 2,
        created_at: now,
        updated_at: now
      })

      await db('player').insert({
        pid: KNOWN_PLAYER_PID,
        formatted_name: 'ktc resolver fixture',
        first_name: 'Ktc',
        last_name: 'Fixture',
        short_name: 'K.Fixture',
        primary_position: 'WR',
        secondary_position: 'WR',
        keeptradecut_player_id: KNOWN_PLAYER_KTC_ID
      })
    })

    it('resolves a known draft pick as RDP', async () => {
      const resolved =
        await resolve_known_keeptradecut_player(KNOWN_PICK_KTC_ID)
      expect(resolved).to.deep.equal({
        pid: `KTCPICK-${KNOWN_PICK_KTC_ID}`,
        is_rdp: true
      })
    })

    it('resolves a known player by vendor id', async () => {
      const resolved =
        await resolve_known_keeptradecut_player(KNOWN_PLAYER_KTC_ID)
      expect(resolved).to.deep.equal({ pid: KNOWN_PLAYER_PID, is_rdp: false })
    })

    // Without a page record there is no name, position or draft year to match
    // on, so an unseen vendor id carries nothing importable. Returning null
    // (rather than throwing) is what keeps one such id from ending the run.
    it('returns null for a vendor id it has never seen', async () => {
      const resolved = await resolve_known_keeptradecut_player(9990999)
      expect(resolved).to.equal(null)
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

  describe('compute_freshness_shortfalls', function () {
    // Table-wide MAX(observed_at) queries with no pid scope, so these tests own
    // the whole table for their duration -- any residual row from another spec
    // could read as fresher than the fixture and mask a shortfall that should
    // fire. Other describe blocks in this file clean up their own pids rather
    // than depending on ambient rows, so clearing here is safe.
    beforeEach(async () => {
      await db('keeptradecut_valuations').del()
    })

    afterEach(async () => {
      await db('keeptradecut_valuations').del()
    })

    const insert_row = ({
      observed_at,
      position_rank = null,
      overall_rank = null
    }) =>
      db('keeptradecut_valuations').insert({
        pid: PLAYER_PID,
        is_superflex: true,
        observed_at,
        keeptradecut_value: 1000,
        position_rank,
        overall_rank
      })

    it('is silent on an ordinary daily value-only run with no rank rows ever written', async () => {
      await insert_row({ observed_at: dayjs().subtract(1, 'hour').toDate() })

      const shortfalls = await compute_freshness_shortfalls()
      shortfalls.should.deep.equal([
        'rank staleness: no rows with position_rank/overall_rank found in keeptradecut_valuations'
      ])
    })

    it('stays silent on rank staleness within the weekly --full cadence', async () => {
      await insert_row({ observed_at: dayjs().subtract(1, 'hour').toDate() })
      await insert_row({
        observed_at: dayjs().subtract(6, 'day').toDate(),
        position_rank: 12,
        overall_rank: 34
      })

      const shortfalls = await compute_freshness_shortfalls()
      shortfalls.should.deep.equal([])
    })

    it('fires on rank staleness once the last full scrape is older than the threshold', async () => {
      await insert_row({ observed_at: dayjs().subtract(1, 'hour').toDate() })
      await insert_row({
        observed_at: dayjs().subtract(9, 'day').toDate(),
        position_rank: 12,
        overall_rank: 34
      })

      const shortfalls = await compute_freshness_shortfalls()
      shortfalls.should.have.lengthOf(1)
      shortfalls[0].should.match(/^rank staleness:/)
    })

    it('fires on value staleness independently of rank staleness', async () => {
      await insert_row({
        observed_at: dayjs().subtract(3, 'day').toDate(),
        position_rank: 12,
        overall_rank: 34
      })

      const shortfalls = await compute_freshness_shortfalls()
      shortfalls.should.have.lengthOf(1)
      shortfalls[0].should.match(/^staleness:/)
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

    it('normalizes real Date rows from the loader before ktc_at compares them', async () => {
      // The block above hand-builds an already-normalized index, so it never
      // drives a real observed_at Date through load_indexes. This exercises
      // the actual load boundary: keeptradecut_valuations.observed_at is
      // timestamptz and returns as a JS Date (db/index.mjs only retypes
      // NUMERIC/INT8). If load_indexes ever stops normalizing it to epoch
      // seconds, `r.d <= target_unix` becomes Date-vs-number, coerces to
      // milliseconds, and is silently always false -- every lookup then falls
      // through to rows[0], the earliest value ever recorded.
      const LOADER_PID = 'TEST-KTCV-000003'
      await db('keeptradecut_valuations').where({ pid: LOADER_PID }).del()
      const observations = [
        { observed_at: new Date('2024-01-01T00:00:00Z'), value: 100 },
        { observed_at: new Date('2024-06-01T00:00:00Z'), value: 200 },
        { observed_at: new Date('2024-12-01T00:00:00Z'), value: 300 }
      ]

      try {
        await db('keeptradecut_valuations').insert(
          observations.map((o) => ({
            pid: LOADER_PID,
            is_superflex: true,
            observed_at: o.observed_at,
            keeptradecut_value: o.value
          }))
        )

        // compute_snapshots_bulk derives the market format class from the
        // league's own seasons/league_formats rows and throws rather than
        // defaulting to superflex, so this needs a real league rather than a
        // synthetic lid. The fixture league is superflex, which is the class
        // the valuations above are written under.
        await league(db)

        const [{ snapshot }] = await compute_snapshots_bulk({
          lid: 1,
          holding_drafts: [
            {
              draft_id: 1,
              asset_type: ASSET_TYPE.PLAYER,
              player_id: LOADER_PID,
              tid: 1,
              year: 2024,
              period_start: new Date('2024-12-31T00:00:00Z'),
              period_end: null,
              league_format_id: null
            }
          ]
        })

        // The bug's signature: silently falling through to the earliest
        // observation (100) for a target well after it, instead of the
        // latest-at-or-before value (300).
        expect(snapshot.keeptradecut_value_at_acquisition).to.not.equal(
          observations[0].value
        )
        expect(snapshot.keeptradecut_value_at_acquisition).to.equal(300)
      } finally {
        await db('keeptradecut_valuations').where({ pid: LOADER_PID }).del()
      }
    })
  })
})
