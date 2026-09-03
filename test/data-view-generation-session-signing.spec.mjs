/* global describe, it */

// THE SIGNED SESSION REQUEST LEAGUE SENDS BASE, EXERCISED RATHER THAN READ.
//
// This file exists because the dispatch leg shipped BROKEN and no test could
// see it. `@trashman/ed25519-blake2b`'s `sign` takes three arguments -- message,
// secret key, PUBLIC KEY -- and throws when the third is omitted. Base's own
// wrapper (libs-server/crypto/ed25519-blake2b.mjs) takes the same three and
// IGNORES the third, so the two-argument call copied from base's call sites
// signs happily there and throws here.
//
// It surfaced as `dispatch_failed` on a production job row, whose summary is
// "the dispatch failed before base answered" -- a message that sends the reader
// to the network and to base's auth rather than to one line of local crypto.
// Every generation dispatch failed this way, and the path had been "verified"
// only with base's own tooling on another host, never through this module.
//
// The lesson generalises past this bug: all three signing traps documented at
// the top of base-session-client.mjs fail FAR from the signing line -- two as
// base's `invalid signature`, one as a local throw filed under a network-shaped
// code. So the assertion that matters is not "a signature came back" but "the
// signature VERIFIES", which is why the positive case below round-trips through
// the library's own verify rather than checking a length.

import fs from 'fs'
import os from 'os'
import path from 'path'
import crypto from 'crypto'

import ed25519 from '@trashman/ed25519-blake2b'

import {
  build_session_request,
  resolve_identity_key_path
} from '#libs-server/data-views/generation/base-session-client.mjs'

process.env.NODE_ENV = 'test'

const expect = (await import('chai')).expect

// A throwaway seed generated per run. Never a real identity key: this file is
// published, and a committed seed is a published credential.
const test_seed = () => crypto.randomBytes(32)

describe('the generation session request', function () {
  describe('signing', function () {
    // THE CASE THAT WAS BROKEN IN PRODUCTION. A two-argument sign throws here,
    // so this fails outright rather than producing something base would reject.
    it('signs without throwing on the three-argument library contract', function () {
      expect(() => build_session_request(test_seed())).to.not.throw()
    })

    // The load-bearing assertion. A signature of the right LENGTH proves
    // nothing -- it is what a wrong curve or a wrongly-hashed payload also
    // produces, and both of those are traps this module has already hit.
    it('produces a signature that VERIFIES against the derived public key', function () {
      const seed = test_seed()
      const { data, signature } = build_session_request(seed)
      const public_key = Buffer.from(ed25519.publicKey(seed))

      expect(
        ed25519.verify(
          Buffer.from(signature, 'hex'),
          ed25519.hash(JSON.stringify(data)),
          public_key
        ),
        'the signature does not verify -- the curve, the hash or the key is wrong'
      ).to.equal(true)
    })

    // THE NEGATIVE CONTROL. Without it, a `verify` that returned true for
    // everything would pass the case above and this whole file would be
    // decoration.
    it('does NOT verify against a different identity', function () {
      const { data, signature } = build_session_request(test_seed())
      const other_public_key = Buffer.from(ed25519.publicKey(test_seed()))

      expect(
        ed25519.verify(
          Buffer.from(signature, 'hex'),
          ed25519.hash(JSON.stringify(data)),
          other_public_key
        )
      ).to.equal(false)
    })

    // The second trap: the server hashes JSON.stringify(data) and signs the
    // HASH. Signing the payload directly fails as `invalid signature`, which
    // names nothing, so it is pinned here where it is cheap to see.
    it('signs the HASH of the payload, not the payload', function () {
      const seed = test_seed()
      const { data, signature } = build_session_request(seed)
      const public_key = Buffer.from(ed25519.publicKey(seed))

      expect(
        ed25519.verify(
          Buffer.from(signature, 'hex'),
          Buffer.from(JSON.stringify(data)),
          public_key
        ),
        'the raw payload verifies, so the signer is not hashing first'
      ).to.equal(false)
    })

    it('carries the public key the signature is made with', function () {
      const seed = test_seed()
      const { data } = build_session_request(seed)
      expect(data.user_public_key).to.equal(
        Buffer.from(ed25519.publicKey(seed)).toString('hex')
      )
    })

    // A replayed body is a body base has already seen. Both fields exist to
    // stop that, so both are asserted to actually move.
    it('carries a fresh nonce and timestamp per request', function () {
      const seed = test_seed()
      const first = build_session_request(seed)
      const second = build_session_request(seed)
      expect(first.data.nonce).to.not.equal(second.data.nonce)
      expect(first.signature).to.not.equal(second.signature)
      expect(first.data.timestamp).to.be.a('number')
    })
  })

  describe('the identity key path', function () {
    it('defaults to the league host location', function () {
      const previous = process.env.LEAGUE_GENERATION_IDENTITY_KEY_FILE
      delete process.env.LEAGUE_GENERATION_IDENTITY_KEY_FILE
      expect(resolve_identity_key_path()).to.equal(
        '/root/.league-data-view-generation-identity.key'
      )
      if (previous) process.env.LEAGUE_GENERATION_IDENTITY_KEY_FILE = previous
    })

    it('is overridable, which is what makes this testable off the host', function () {
      const previous = process.env.LEAGUE_GENERATION_IDENTITY_KEY_FILE
      const override = path.join(os.tmpdir(), 'generation-key-probe')
      process.env.LEAGUE_GENERATION_IDENTITY_KEY_FILE = override
      expect(resolve_identity_key_path()).to.equal(override)
      if (previous) process.env.LEAGUE_GENERATION_IDENTITY_KEY_FILE = previous
      else delete process.env.LEAGUE_GENERATION_IDENTITY_KEY_FILE
      fs.rmSync(override, { force: true })
    })
  })
})
