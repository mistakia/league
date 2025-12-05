/* global describe, before, beforeEach, afterEach, it */
import * as chai from 'chai'
import chai_http, { request as chai_request } from 'chai-http'

import server from '#api'
import knex from '#db'

process.env.NODE_ENV = 'test'
chai.use(chai_http)
chai.should()

describe('API /selection-combinations', function () {
  before(async function () {
    this.timeout(60 * 1000)
    await knex.seed.run()
  })

  const test_combination_definition = {
    combination_id: 9999,
    combination_name: 'TEST_QB_WR_COMBO',
    combination_description: 'Test combination for API testing',
    selections: JSON.stringify([
      { position: 'QB', market: 'GAME_ALT_PASSING_YARDS' },
      { position: 'WR', market: 'GAME_ALT_RECEIVING_YARDS' }
    ]),
    active: true
  }

  const test_player_1 = {
    pid: 'TEST-PLAY-2024-1990-01-01',
    fname: 'Test',
    lname: 'Quarterback',
    pname: 'T.Quarterback',
    formatted: 'Test Quarterback',
    pos: 'QB',
    pos1: 'QB',
    dob: '1990-01-01',
    nfl_draft_year: 2012,
    current_nfl_team: 'NYG',
    pff_id: 99901,
    gsis_it_id: 88801,
    gsisid: '00-0099901'
  }

  const test_player_2 = {
    pid: 'TEST-RECV-2024-1992-02-02',
    fname: 'Test',
    lname: 'Receiver',
    pname: 'T.Receiver',
    formatted: 'Test Receiver',
    pos: 'WR',
    pos1: 'WR',
    dob: '1992-02-02',
    nfl_draft_year: 2014,
    current_nfl_team: 'DAL',
    pff_id: 99902,
    gsis_it_id: 88802,
    gsisid: '00-0099902'
  }

  const test_odds_record = {
    combination_id: 9999,
    source_id: 'FANDUEL',
    selection_ids: [
      'ESBID:2025120799|MARKET:GAME_ALT_PASSING_YARDS|PID:TEST-PLAY-2024-1990-01-01|SEL:OVER|LINE:299.5',
      'ESBID:2025120799|MARKET:GAME_ALT_RECEIVING_YARDS|PID:TEST-RECV-2024-1992-02-02|SEL:OVER|LINE:99.5'
    ],
    esbid: 2025120799,
    year: 2025,
    week: 14,
    decimal_odds: '15.500',
    american_odds: 1450,
    is_sgp: true,
    timestamp: 1764963500
  }

  beforeEach(async function () {
    // Insert test data
    await knex('selection_combination_definitions')
      .insert(test_combination_definition)
      .onConflict('combination_id')
      .ignore()

    await knex('player').insert(test_player_1).onConflict('pid').merge()

    await knex('player').insert(test_player_2).onConflict('pid').merge()

    await knex('selection_combination_odds_index')
      .insert(test_odds_record)
      .onConflict(['combination_id', 'source_id', 'selection_ids'])
      .ignore()
  })

  afterEach(async function () {
    // Clean up test data
    await knex('selection_combination_odds_index')
      .where('esbid', 2025120799)
      .del()

    await knex('selection_combination_definitions')
      .where('combination_id', 9999)
      .del()

    await knex('player')
      .whereIn('pid', [test_player_1.pid, test_player_2.pid])
      .del()
  })

  describe('GET /api/selection-combinations', function () {
    it('should return JSON output by default', async function () {
      const res = await chai_request
        .execute(server)
        .get('/api/selection-combinations')
        .query({ year: 2025, week: 14 })

      res.should.have.status(200)
      res.should.have.header('content-type', /application\/json/)
      res.body.should.be.an('array')
    })

    it('should filter by year and week', async function () {
      const res = await chai_request
        .execute(server)
        .get('/api/selection-combinations')
        .query({ year: 2025, week: 14, esbid: 2025120799 })

      res.should.have.status(200)
      res.body.should.be.an('array')

      // Find our test record
      const test_record = res.body.find((r) => r.esbid === 2025120799)
      if (test_record) {
        test_record.should.have.property('combination_name', 'TEST_QB_WR_COMBO')
        test_record.should.have.property('year', 2025)
        test_record.should.have.property('week', 14)
      }
    })

    it('should filter by source_id', async function () {
      const res = await chai_request
        .execute(server)
        .get('/api/selection-combinations')
        .query({ source_id: 'FANDUEL', year: 2025 })

      res.should.have.status(200)
      res.body.should.be.an('array')

      // All records should be from FANDUEL
      for (const record of res.body) {
        record.should.have.property('source_id', 'FANDUEL')
      }
    })

    it('should return CSV output when format=csv', async function () {
      const res = await chai_request
        .execute(server)
        .get('/api/selection-combinations')
        .query({ format: 'csv', year: 2025, week: 14 })

      res.should.have.status(200)
      res.should.have.header('content-type', /text\/csv/)
      res.should.have.header('content-disposition', /attachment/)
      res.text.should.be.a('string')

      // CSV should have header row with expected columns
      if (res.text.length > 0) {
        const lines = res.text.split('\r\n')
        lines[0].should.include('combination_name')
        lines[0].should.include('source_id')
        lines[0].should.include('decimal_odds')
      }
    })

    it('should expand selection details with player info', async function () {
      const res = await chai_request
        .execute(server)
        .get('/api/selection-combinations')
        .query({ year: 2025, week: 14 })

      res.should.have.status(200)

      // Find our test record
      const test_record = res.body.find((r) => r.esbid === 2025120799)
      if (test_record) {
        // Check first selection fields
        test_record.should.have.property(
          'selection_1_market_type',
          'GAME_ALT_PASSING_YARDS'
        )
        test_record.should.have.property('selection_1_line', 299.5)
        test_record.should.have.property('selection_1_selection_type', 'OVER')
        test_record.should.have.property('selection_1_first_name', 'Test')
        test_record.should.have.property('selection_1_last_name', 'Quarterback')
        test_record.should.have.property('selection_1_player_position', 'QB')
        test_record.should.have.property('selection_1_nfl_team', 'NYG')
        test_record.should.have.property('selection_1_player_pff_id', 99901)
        test_record.should.have.property('selection_1_player_gsis_it_id', 88801)
        test_record.should.have.property(
          'selection_1_player_gsisid',
          '00-0099901'
        )

        // Check second selection fields
        test_record.should.have.property(
          'selection_2_market_type',
          'GAME_ALT_RECEIVING_YARDS'
        )
        test_record.should.have.property('selection_2_line', 99.5)
        test_record.should.have.property('selection_2_selection_type', 'OVER')
        test_record.should.have.property('selection_2_first_name', 'Test')
        test_record.should.have.property('selection_2_last_name', 'Receiver')
        test_record.should.have.property('selection_2_player_position', 'WR')
        test_record.should.have.property('selection_2_nfl_team', 'DAL')
        test_record.should.have.property('selection_2_player_pff_id', 99902)
        test_record.should.have.property('selection_2_player_gsis_it_id', 88802)
        test_record.should.have.property(
          'selection_2_player_gsisid',
          '00-0099902'
        )
      }
    })

    it('should return null for missing player data', async function () {
      // Insert a record with a non-existent player
      const non_existent_player_record = {
        combination_id: 9999,
        source_id: 'FANDUEL',
        selection_ids: [
          'ESBID:2025120798|MARKET:GAME_ALT_PASSING_YARDS|PID:NONEXISTENT-PLAYER|SEL:OVER|LINE:250.5'
        ],
        esbid: 2025120798,
        year: 2025,
        week: 14,
        decimal_odds: '5.000',
        american_odds: 400,
        is_sgp: true,
        timestamp: 1764963501
      }

      await knex('selection_combination_odds_index')
        .insert(non_existent_player_record)
        .onConflict(['combination_id', 'source_id', 'selection_ids'])
        .ignore()

      try {
        const res = await chai_request
          .execute(server)
          .get('/api/selection-combinations')
          .query({ year: 2025, week: 14 })

        res.should.have.status(200)

        // Find the record with non-existent player
        const record = res.body.find((r) => r.esbid === 2025120798)
        if (record) {
          // Player fields should be null for non-existent player
          chai.expect(record.selection_1_first_name).to.be.null
          chai.expect(record.selection_1_last_name).to.be.null
          chai.expect(record.selection_1_player_pff_id).to.be.null
          chai.expect(record.selection_1_player_gsis_it_id).to.be.null
          chai.expect(record.selection_1_player_gsisid).to.be.null
          // But market fields should still be populated
          record.should.have.property(
            'selection_1_market_type',
            'GAME_ALT_PASSING_YARDS'
          )
          record.should.have.property('selection_1_line', 250.5)
        }
      } finally {
        await knex('selection_combination_odds_index')
          .where('esbid', 2025120798)
          .del()
      }
    })

    it('should return empty array for no matching results', async function () {
      const res = await chai_request
        .execute(server)
        .get('/api/selection-combinations')
        .query({ year: 1999, week: 99 })

      res.should.have.status(200)
      res.body.should.be.an('array').that.is.empty
    })

    it('should return empty CSV for no matching results', async function () {
      const res = await chai_request
        .execute(server)
        .get('/api/selection-combinations')
        .query({ format: 'csv', year: 1999, week: 99 })

      res.should.have.status(200)
      res.should.have.header('content-type', /text\/csv/)
      res.text.should.equal('')
    })

    it('should respect limit parameter', async function () {
      const res = await chai_request
        .execute(server)
        .get('/api/selection-combinations')
        .query({ limit: 5 })

      res.should.have.status(200)
      res.body.should.be.an('array')
      res.body.length.should.be.at.most(5)
    })

    it('should respect offset parameter', async function () {
      // Get all results first
      const all_res = await chai_request
        .execute(server)
        .get('/api/selection-combinations')
        .query({ limit: 10 })

      // Get results with offset
      const offset_res = await chai_request
        .execute(server)
        .get('/api/selection-combinations')
        .query({ limit: 10, offset: 1 })

      all_res.should.have.status(200)
      offset_res.should.have.status(200)

      // If we have at least 2 results, the first result with offset should match
      // the second result without offset
      if (all_res.body.length >= 2) {
        offset_res.body[0].timestamp.should.equal(all_res.body[1].timestamp)
      }
    })

    it('should filter by combination_id', async function () {
      const res = await chai_request
        .execute(server)
        .get('/api/selection-combinations')
        .query({ combination_id: 9999 })

      res.should.have.status(200)
      res.body.should.be.an('array')

      // All records should have the test combination name
      for (const record of res.body) {
        record.should.have.property('combination_name', 'TEST_QB_WR_COMBO')
      }
    })
  })
})
