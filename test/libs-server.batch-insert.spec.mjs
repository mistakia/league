/* global describe, it */
import * as chai from 'chai'

import batch_insert from '#libs-server/batch-insert.mjs'

process.env.NODE_ENV = 'test'
const expect = chai.expect

const defer = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

describe('LIBS-SERVER batch_insert', function () {
  describe('chunking', function () {
    it('splits items into batch_size slices, covering every item in order', async () => {
      const items = Array.from({ length: 23 }, (_, i) => i)
      const chunks = []

      await batch_insert({
        items,
        batch_size: 10,
        save: async (chunk) => {
          chunks.push(chunk)
        }
      })

      expect(chunks.map((chunk) => chunk.length)).to.deep.equal([10, 10, 3])
      expect(chunks.flat()).to.deep.equal(items)
    })

    it('does not call save for an empty item list', async () => {
      let calls = 0

      await batch_insert({
        items: [],
        batch_size: 10,
        save: async () => {
          calls++
        }
      })

      expect(calls).to.equal(0)
    })
  })

  describe('concurrency', function () {
    // The default has to stay serial: there are 75 call sites written against a
    // sequential loop, and whether two chunks may overlap is a property of the
    // save callback rather than of the chunking.
    it('runs strictly serially by default', async () => {
      let in_flight = 0
      let max_in_flight = 0

      await batch_insert({
        items: Array.from({ length: 20 }, (_, i) => i),
        batch_size: 5,
        save: async () => {
          in_flight++
          max_in_flight = Math.max(max_in_flight, in_flight)
          await defer(5)
          in_flight--
        }
      })

      expect(max_in_flight).to.equal(1)
    })

    it('overlaps chunks up to the concurrency bound and never beyond it', async () => {
      let in_flight = 0
      let max_in_flight = 0

      await batch_insert({
        items: Array.from({ length: 40 }, (_, i) => i),
        batch_size: 5,
        concurrency: 3,
        save: async () => {
          in_flight++
          max_in_flight = Math.max(max_in_flight, in_flight)
          await defer(5)
          in_flight--
        }
      })

      expect(max_in_flight).to.equal(3)
    })

    it('still covers every item exactly once when running concurrently', async () => {
      const items = Array.from({ length: 47 }, (_, i) => i)
      const seen = []

      await batch_insert({
        items,
        batch_size: 5,
        concurrency: 4,
        save: async (chunk) => {
          await defer(Math.random() * 5)
          seen.push(...chunk)
        }
      })

      expect(seen.length).to.equal(items.length)
      expect([...seen].sort((a, b) => a - b)).to.deep.equal(items)
    })

    it('does not spawn more workers than there are chunks', async () => {
      let max_in_flight = 0
      let in_flight = 0

      await batch_insert({
        items: [1, 2, 3],
        batch_size: 5,
        concurrency: 8,
        save: async () => {
          in_flight++
          max_in_flight = Math.max(max_in_flight, in_flight)
          await defer(5)
          in_flight--
        }
      })

      expect(max_in_flight).to.equal(1)
    })
  })

  describe('failure handling', function () {
    it('propagates a rejection from a serial save', async () => {
      let error = null

      try {
        await batch_insert({
          items: [1, 2, 3, 4],
          batch_size: 2,
          save: async (chunk) => {
            if (chunk[0] === 3) {
              throw new Error('boom')
            }
          }
        })
      } catch (err) {
        error = err
      }

      expect(error).to.be.an('error')
      expect(error.message).to.equal('boom')
    })

    // An in-flight query cannot be cancelled, so a concurrent failure must drain
    // the other workers before rethrowing. Rejecting eagerly would leave them to
    // settle unobserved and surface as unhandled rejections later, attributed to
    // whatever happened to be running when the process noticed.
    it('drains in-flight workers before rethrowing, and rethrows the failure', async () => {
      let settled = 0
      let error = null

      try {
        await batch_insert({
          items: Array.from({ length: 20 }, (_, i) => i),
          batch_size: 5,
          concurrency: 4,
          save: async (chunk) => {
            await defer(10)
            if (chunk[0] === 0) {
              throw new Error('boom')
            }
            settled++
          }
        })
      } catch (err) {
        error = err
      }

      expect(error).to.be.an('error')
      expect(error.message).to.equal('boom')
      expect(settled).to.equal(3)
    })
  })
})
