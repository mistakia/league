/* global describe, it, before, after */
import * as chai from 'chai'
import crypto from 'crypto'

import {
  encrypt_credentials,
  decrypt_credentials,
  is_encrypted,
  migrate_credentials
} from '#libs-server/external-fantasy-leagues/utils/credential-encryption.mjs'

const expect = chai.expect

// A stable 64-hex test key injected via the dependency-injection seam, so this
// suite needs neither sops nor an age identity (it runs on non-recipient CI).
const TEST_KEY_HEX = crypto.randomBytes(32).toString('hex')
const OTHER_KEY_HEX = crypto.randomBytes(32).toString('hex')
// The retired NODE_ENV-gated weak key. Its derivation must no longer be
// reachable from the resolver (regression guard below).
const WEAK_KEY_HEX = crypto
  .scryptSync('development-fallback-key', 'salt', 32)
  .toString('hex')

describe('External Fantasy Leagues - Credential Encryption', function () {
  describe('dependency-injected key (no sops/age needed)', function () {
    it('round-trips an object through encrypt/decrypt with an explicit key', function () {
      const creds = { username: 'a', password: 'b', league_cookie: 'c' }
      const cipher = encrypt_credentials(creds, { key_hex: TEST_KEY_HEX })
      expect(cipher).to.be.a('string')
      expect(is_encrypted(cipher)).to.equal(true)
      const roundtrip = decrypt_credentials(cipher, { key_hex: TEST_KEY_HEX })
      expect(roundtrip).to.deep.equal(creds)
    })

    it('fails closed (throws, no plaintext) when the wrong key is supplied', function () {
      const cipher = encrypt_credentials(
        { secret: 'value' },
        { key_hex: TEST_KEY_HEX }
      )
      expect(() =>
        decrypt_credentials(cipher, { key_hex: OTHER_KEY_HEX })
      ).to.throw()
    })

    it('rejects a malformed key_hex', function () {
      expect(() =>
        encrypt_credentials({ a: 1 }, { key_hex: 'not-hex' })
      ).to.throw(/64 hex/)
    })

    it('returns null for empty or non-object credentials', function () {
      expect(encrypt_credentials({}, { key_hex: TEST_KEY_HEX })).to.equal(null)
      expect(encrypt_credentials(null, { key_hex: TEST_KEY_HEX })).to.equal(
        null
      )
    })

    it('returns {} for empty decrypt input', function () {
      expect(decrypt_credentials('', { key_hex: TEST_KEY_HEX })).to.deep.equal(
        {}
      )
      expect(
        decrypt_credentials(null, { key_hex: TEST_KEY_HEX })
      ).to.deep.equal({})
    })

    it('reads legacy {-prefixed plaintext-JSON rows regardless of key', function () {
      const legacy = JSON.stringify({ username: 'legacy' })
      expect(
        decrypt_credentials(legacy, { key_hex: TEST_KEY_HEX })
      ).to.deep.equal({
        username: 'legacy'
      })
      // migrate_credentials encrypts a legacy row under the supplied key
      const migrated = migrate_credentials(legacy, { key_hex: TEST_KEY_HEX })
      expect(is_encrypted(migrated)).to.equal(true)
      expect(
        decrypt_credentials(migrated, { key_hex: TEST_KEY_HEX })
      ).to.deep.equal({ username: 'legacy' })
    })
  })

  describe('no NODE_ENV discriminator (regression guard)', function () {
    let saved_node_env
    let saved_env_key

    before(function () {
      saved_node_env = process.env.NODE_ENV
      saved_env_key = process.env.EXTERNAL_LEAGUE_ENCRYPTION_KEY
      // Reproduce the old fallback trigger: env key unset.
      delete process.env.EXTERNAL_LEAGUE_ENCRYPTION_KEY
    })

    after(function () {
      if (saved_node_env === undefined) delete process.env.NODE_ENV
      else process.env.NODE_ENV = saved_node_env
      if (saved_env_key === undefined)
        delete process.env.EXTERNAL_LEAGUE_ENCRYPTION_KEY
      else process.env.EXTERNAL_LEAGUE_ENCRYPTION_KEY = saved_env_key
    })

    it('the explicit-key path is identical across every NODE_ENV', function () {
      const creds = { u: 'x', p: 'y' }
      for (const env of ['test', 'development', 'production', undefined]) {
        if (env === undefined) delete process.env.NODE_ENV
        else process.env.NODE_ENV = env
        const cipher = encrypt_credentials(creds, { key_hex: TEST_KEY_HEX })
        expect(
          decrypt_credentials(cipher, { key_hex: TEST_KEY_HEX })
        ).to.deep.equal(creds)
      }
    })

    it('no NODE_ENV selects the retired development-fallback key', function () {
      // The old resolver returned scrypt('development-fallback-key') when the env
      // var was unset under NODE_ENV=development|test. The rewrite deleted that
      // branch: with no key_hex the resolver goes to sops. On a non-recipient host
      // (CI) that throws fail-closed; on a recipient host it yields a real key.
      // Either way the weak key must NEVER be produced.
      for (const env of ['test', 'development', 'production']) {
        process.env.NODE_ENV = env
        let cipher = null
        try {
          cipher = encrypt_credentials({ secret: 'x' })
        } catch {
          cipher = null // fail-closed: retired fallback is gone
        }
        if (cipher) {
          // A ciphertext resolved via sops must not be the weak dev-fallback key.
          expect(() =>
            decrypt_credentials(cipher, { key_hex: WEAK_KEY_HEX })
          ).to.throw()
        }
      }
    })
  })
})
