/* global describe it */
import * as chai from 'chai'

import {
  resolve_export_api_key,
  resolve_export_max_limit,
  generate_api_key,
  hash_api_key,
  EXPORT_DEFAULT_MAX_LIMIT
} from '../libs-server/data-views/export-api-keys.mjs'
import {
  get_table_state_validator,
  DATA_VIEW_DEFAULT_MAX_LIMIT
} from '../libs-server/validators.mjs'

chai.should()
const expect = chai.expect

// A knex stand-in over one in-memory table set. Enough for the two queries the
// key resolver and the ceiling lookup issue, and nothing beyond them.
const make_database = ({ api_keys = [], users = [] } = {}) => {
  const updates = []

  const database = (table_name) => {
    const state = {
      table_name,
      predicates: [],
      null_predicates: []
    }

    const rows = () => (table_name === 'users' ? users : api_keys)

    const matches = (row) =>
      state.predicates.every(([column, value]) => row[column] === value) &&
      state.null_predicates.every((column) => row[column] == null)

    const builder = {
      select: () => builder,
      where: (column, value) => {
        if (typeof column === 'object') {
          Object.entries(column).forEach((entry) =>
            state.predicates.push(entry)
          )
        } else {
          state.predicates.push([column, value])
        }
        return builder
      },
      whereNull: (column) => {
        state.null_predicates.push(column)
        return builder
      },
      first: async () => rows().find(matches) || undefined,
      update: async (values) => {
        updates.push({ table_name, values })
        return 1
      },
      // resolve_export_api_key fires the last_used_at update without awaiting,
      // so the returned object has to be thenable AND carry .catch.
      then: (resolve) => Promise.resolve(rows().filter(matches)).then(resolve),
      catch: () => builder
    }

    return builder
  }

  database.updates = updates
  return database
}

describe('data view export — row ceiling and api keys', function () {
  describe('resolve_export_api_key', function () {
    it('returns null when no key is presented', async () => {
      const result = await resolve_export_api_key({
        headers: {},
        database: make_database()
      })
      expect(result).to.equal(null)
    })

    it('returns null for a key that matches nothing', async () => {
      const result = await resolve_export_api_key({
        headers: { 'x-api-key': 'not-a-real-key' },
        database: make_database({
          api_keys: [
            {
              api_key_id: 1,
              user_id: 7,
              key_hash: hash_api_key('the-real-key'),
              revoked_at: null
            }
          ]
        })
      })
      expect(result).to.equal(null)
    })

    it('returns null for a revoked key', async () => {
      const result = await resolve_export_api_key({
        headers: { 'x-api-key': 'the-real-key' },
        database: make_database({
          api_keys: [
            {
              api_key_id: 1,
              user_id: 7,
              key_hash: hash_api_key('the-real-key'),
              revoked_at: new Date()
            }
          ]
        })
      })
      expect(result).to.equal(null)
    })

    it('resolves the owning user for a live key', async () => {
      const database = make_database({
        api_keys: [
          {
            api_key_id: 3,
            user_id: 7,
            key_hash: hash_api_key('the-real-key'),
            revoked_at: null
          }
        ]
      })
      const result = await resolve_export_api_key({
        headers: { 'x-api-key': 'the-real-key' },
        database
      })
      expect(result).to.deep.equal({ api_key_id: 3, user_id: 7 })
      database.updates.should.have.length(1)
      database.updates[0].table_name.should.equal('user_api_keys')
      expect(database.updates[0].values.last_used_at).to.be.a('date')
    })
  })

  describe('generate_api_key', function () {
    it('mints a key whose stored hash matches the plaintext, with a prefix drawn from it', () => {
      const { plaintext, key_hash, key_prefix } = generate_api_key()
      key_hash.should.equal(hash_api_key(plaintext))
      key_hash.should.have.length(64)
      plaintext.startsWith(key_prefix).should.equal(true)
      key_prefix.should.have.length(12)
    })

    it('does not repeat', () => {
      const first = generate_api_key()
      const second = generate_api_key()
      first.plaintext.should.not.equal(second.plaintext)
    })
  })

  describe('resolve_export_max_limit', function () {
    it('gives an anonymous caller the platform default', async () => {
      const max_limit = await resolve_export_max_limit({
        user_id: null,
        database: make_database()
      })
      max_limit.should.equal(EXPORT_DEFAULT_MAX_LIMIT)
    })

    it("reads the user's own ceiling", async () => {
      const max_limit = await resolve_export_max_limit({
        user_id: 7,
        database: make_database({
          users: [{ id: 7, data_view_export_max_rows: 250000 }]
        })
      })
      max_limit.should.equal(250000)
    })

    it('reads NULL as no ceiling', async () => {
      const max_limit = await resolve_export_max_limit({
        user_id: 7,
        database: make_database({
          users: [{ id: 7, data_view_export_max_rows: null }]
        })
      })
      expect(max_limit).to.equal(null)
    })

    it('falls back to the default for a user row that is not there', async () => {
      const max_limit = await resolve_export_max_limit({
        user_id: 7,
        database: make_database({ users: [] })
      })
      max_limit.should.equal(EXPORT_DEFAULT_MAX_LIMIT)
    })
  })

  describe('get_table_state_validator', function () {
    const table_state = (limit) => ({ limit, columns: [], where: [], sort: [] })

    it('holds the interactive ceiling by default', () => {
      const validator = get_table_state_validator()
      validator(table_state(DATA_VIEW_DEFAULT_MAX_LIMIT)).should.equal(true)
      // The negative control: without it a validator that accepted everything
      // would pass every other case here.
      const result = validator(table_state(DATA_VIEW_DEFAULT_MAX_LIMIT + 1))
      result.should.be.an('array')
      result[0].field.should.equal('limit')
    })

    it('admits a larger page under a raised ceiling', () => {
      const validator = get_table_state_validator({ max_limit: 250000 })
      validator(table_state(100000)).should.equal(true)
      validator(table_state(250001)).should.be.an('array')
    })

    it('admits any page under no ceiling', () => {
      const validator = get_table_state_validator({ max_limit: null })
      validator(table_state(5000000)).should.equal(true)
    })

    it('rejects a limit below one at every ceiling', () => {
      get_table_state_validator({ max_limit: null })(
        table_state(0)
      ).should.be.an('array')
    })
  })
})
