/* global describe it */
import * as chai from 'chai'

import {
  assert_destructive_target_allowed,
  assert_destructive_target_values_allowed
} from '#db/guard-destructive-target.mjs'

const expect = chai.expect

// A fake knex whose raw() answers what a live server would. The guard reads
// current_database() from the connection, so a stub server plus a stub pool
// config is the whole surface -- no database needed, and the refusing cases are
// exactly the ones a real database could not safely exercise.
const fake_knex = ({ database, user = 'league_test', host, port = 5433 }) => ({
  raw: async () => ({ rows: [{ database, user, server_addr: null }] }),
  client: { config: { connection: { host, port } } }
})

describe('db/guard-destructive-target', function () {
  describe('assert_destructive_target_allowed', function () {
    it('allows the test database on loopback', async () => {
      const target = await assert_destructive_target_allowed({
        knex: fake_knex({ database: 'league_test', host: '127.0.0.1' }),
        operation: 'unit test'
      })
      expect(target.database).to.equal('league_test')
      expect(target.host).to.equal('127.0.0.1')
    })

    it('allows a per-session isolated database on loopback', async () => {
      // CLAUDE.md's concurrency recipe: LEAGUE_DB_DATABASE=league_test_<slug>.
      const target = await assert_destructive_target_allowed({
        knex: fake_knex({ database: 'league_test_guard', host: 'localhost' }),
        operation: 'unit test'
      })
      expect(target.database).to.equal('league_test_guard')
    })

    it('REFUSES the production database even on loopback', async () => {
      // The SSH-tunnel shape: production reached through 127.0.0.1.
      let error
      try {
        await assert_destructive_target_allowed({
          knex: fake_knex({
            database: 'league_production',
            user: 'league_writer',
            host: '127.0.0.1'
          }),
          operation: 'unit test'
        })
      } catch (err) {
        error = err
      }
      expect(error, 'guard did not refuse').to.exist
      expect(error.message).to.include('REFUSED')
      expect(error.message).to.include('league_production')
    })

    it('REFUSES an allowlisted database name on a remote host', async () => {
      let error
      try {
        await assert_destructive_target_allowed({
          knex: fake_knex({ database: 'league_test', host: '38.242.199.45' }),
          operation: 'unit test'
        })
      } catch (err) {
        error = err
      }
      expect(error, 'guard did not refuse').to.exist
      expect(error.message).to.include('not loopback')
    })

    it('REFUSES when the connection declares no host', async () => {
      let error
      try {
        await assert_destructive_target_allowed({
          knex: fake_knex({ database: 'league_test', host: undefined }),
          operation: 'unit test'
        })
      } catch (err) {
        error = err
      }
      expect(error, 'guard did not refuse').to.exist
      expect(error.message).to.include('REFUSED')
    })

    it('REFUSES when the server will not answer', async () => {
      let error
      try {
        await assert_destructive_target_allowed({
          knex: {
            raw: async () => {
              throw new Error('connection terminated')
            },
            client: { config: { connection: { host: '127.0.0.1' } } }
          },
          operation: 'unit test'
        })
      } catch (err) {
        error = err
      }
      expect(error, 'guard did not refuse').to.exist
      expect(error.message).to.include('unverified')
    })

    it('REFUSES when handed no connection at all', async () => {
      let error
      try {
        await assert_destructive_target_allowed({ operation: 'unit test' })
      } catch (err) {
        error = err
      }
      expect(error, 'guard did not refuse').to.exist
      expect(error.message).to.include('REFUSED')
    })
  })

  describe('assert_destructive_target_values_allowed', function () {
    it('allows the development database on loopback', () => {
      const target = assert_destructive_target_values_allowed({
        host: '127.0.0.1',
        database: 'league_development',
        user: 'league_development',
        operation: 'unit test'
      })
      expect(target.database).to.equal('league_development')
    })

    it('REFUSES the production database', () => {
      expect(() =>
        assert_destructive_target_values_allowed({
          host: '127.0.0.1',
          database: 'league_production',
          operation: 'unit test'
        })
      ).to.throw(/REFUSED/)
    })

    it('REFUSES a remote host', () => {
      expect(() =>
        assert_destructive_target_values_allowed({
          host: '38.242.199.45',
          database: 'league_development',
          operation: 'unit test'
        })
      ).to.throw(/not loopback/)
    })

    it('REFUSES when no database name was resolved', () => {
      expect(() =>
        assert_destructive_target_values_allowed({
          host: '127.0.0.1',
          operation: 'unit test'
        })
      ).to.throw(/unverified/)
    })
  })
})
