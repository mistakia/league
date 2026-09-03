/* global describe, it */

import fs from 'fs'
import path from 'path'

import * as chai from 'chai'

import {
  GENERATION_FAILURES,
  describe_generation_failure,
  generation_failure_status,
  is_retryable_generation_failure
} from '#libs-server/data-views/generation/generation-failure-contract.mjs'

process.env.NODE_ENV = 'test'

const expect = chai.expect

// The modules that can END a generation with a named code. The contract is the
// union of what these raise, so the drift gate below reads them rather than a
// hand-kept list -- a hand-kept list is the same maintenance burden the
// registry exists to replace, one layer up.
const CODE_SOURCES = [
  'libs-server/data-views/generation/generation-job-queue.mjs',
  'libs-server/data-views/generation/base-session-client.mjs',
  'libs-server/data-views/generation/generation-drainer.mjs',
  'api/sockets/data-view-generation.mjs'
]

// Matches the two shapes a code is written in across those files: the first
// argument to a GenerationQueueError / BaseSessionError constructor, and an
// `error_code:` property. Anchored on the syntactic ROLE rather than on the
// token, so a code appearing in prose or in a comment is not counted.
const collect_declared_codes = (source) => {
  const codes = new Set()
  for (const match of source.matchAll(
    /new (?:GenerationQueueError|BaseSessionError)\(\s*'([a-z_]+)'/g
  )) {
    codes.add(match[1])
  }
  for (const match of source.matchAll(/error_code:\s*'([a-z_]+)'/g)) {
    codes.add(match[1])
  }
  return codes
}

describe('data view generation failure contract', function () {
  describe('the drift gate', function () {
    // THE LOAD-BEARING CASE. Every code these modules can raise must be
    // registered, or a client renders a refusal it has never heard of --
    // which is exactly how the codes came to be scattered across three
    // modules with nothing listing them in the first place.
    it('registers every code the generation modules actually raise', function () {
      const unregistered = []
      let seen = 0

      for (const relative of CODE_SOURCES) {
        const source = fs.readFileSync(
          path.join(process.cwd(), relative),
          'utf8'
        )
        for (const code of collect_declared_codes(source)) {
          seen += 1
          if (!describe_generation_failure(code)) {
            unregistered.push(`${code} (${relative})`)
          }
        }
      }

      // The pattern must have MATCHED something, or a zero-match regex would
      // report a confident pass against a contract it never read.
      expect(
        seen,
        'the code pattern matched nothing -- it has gone stale'
      ).to.be.greaterThan(8)
      expect(
        unregistered,
        `unregistered generation failure codes: ${unregistered.join(', ')}`
      ).to.deep.equal([])
    })

    it('declares all three fields on every registered failure', function () {
      for (const [code, failure] of Object.entries(GENERATION_FAILURES)) {
        expect(failure.summary, `${code} summary`).to.be.a('string').and.not
          .empty
        expect(failure.caller_fault, `${code} caller_fault`).to.be.a('boolean')
        expect(failure.retryable, `${code} retryable`).to.be.a('boolean')
      }
    })
  })

  describe('an undeclared code', function () {
    // Returns null rather than a plausible default, because a default lets an
    // unregistered code render as though it were understood.
    it('describes as null rather than inventing a default', function () {
      expect(describe_generation_failure('no_such_code')).to.equal(null)
      expect(is_retryable_generation_failure('no_such_code')).to.equal(false)
    })

    it('is a 500, since it is a bug in league rather than a bad request', function () {
      expect(generation_failure_status('no_such_code')).to.equal(500)
    })
  })

  describe('the status mapping', function () {
    it('answers 5xx for everything the caller could not have caused', function () {
      for (const [code, failure] of Object.entries(GENERATION_FAILURES)) {
        if (failure.caller_fault) continue
        expect(
          generation_failure_status(code),
          `${code} is not the caller's fault and must not be a 4xx`
        ).to.be.greaterThan(499)
      }
    })

    it('answers 4xx for everything the caller can fix or retry', function () {
      for (const [code, failure] of Object.entries(GENERATION_FAILURES)) {
        if (!failure.caller_fault) continue
        const status = generation_failure_status(code)
        expect(status, `${code}`).to.be.within(400, 499)
      }
    })

    it('uses 429 for a full queue and 503 for a busy rail', function () {
      // The distinction is whose queue is full. The caller can see league's
      // depth and decide; base's one session slot is not theirs to reason
      // about, so it reads as the service being briefly unavailable.
      expect(generation_failure_status('queue_full')).to.equal(429)
      expect(generation_failure_status('base_capacity_reached')).to.equal(503)
      expect(generation_failure_status('base_container_unreadable')).to.equal(
        503
      )
    })
  })

  describe('what is deliberately NOT in the contract', function () {
    // Both were league-as-inference-client failure modes. League holds neither
    // credential now and makes no model call at all, so a failure path for
    // them would be a path for a request league does not make.
    it('carries no provider-auth classes', function () {
      const codes = Object.keys(GENERATION_FAILURES).join(' ')
      expect(codes).to.not.match(/cloudflare|access|machine_token/)
    })

    // A refusal the AGENT made is a completed job carrying
    // generation_branch = 'refusal', never a failure -- recording it here
    // would fold a legitimate answer in with the provider being unreachable.
    it('carries no code for an agent refusal', function () {
      expect(GENERATION_FAILURES).to.not.have.property('agent_refusal')
      expect(GENERATION_FAILURES).to.not.have.property('inexpressible')
    })
  })

  describe('retryability', function () {
    it('is true for exactly the outcomes that clear without a change', function () {
      const retryable = Object.entries(GENERATION_FAILURES)
        .filter(([, failure]) => failure.retryable)
        .map(([code]) => code)
        .sort()
      expect(retryable).to.deep.equal([
        'base_capacity_reached',
        'base_container_unreadable',
        'deadline_exceeded',
        'queue_full'
      ])
    })

    it('is false for every configuration failure', function () {
      for (const code of [
        'base_api_url_unset',
        'identity_key_unreadable',
        'identity_key_malformed',
        'session_mint_failed'
      ]) {
        expect(is_retryable_generation_failure(code), code).to.equal(false)
      }
    })
  })
})
