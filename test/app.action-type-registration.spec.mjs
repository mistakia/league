/* global describe it */
import * as chai from 'chai'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const core_dir = path.join(__dirname, '../app/core')

chai.should()

// `create_api_actions('X')` returns the action CREATORS a saga calls;
// `create_api_action_types('X')` returns the type CONSTANTS a reducer switches
// on. They are separate helpers and a module needs both: export the creators
// without spreading the types and every `actions.X_FULFILLED` a reducer names
// is `undefined`, so its cases become `case undefined` and never match the
// string the saga actually dispatches.
//
// The failure is silent in the usual way -- valid JavaScript, no lint error,
// the build succeeds, and the only symptom is a store that never updates. It
// shipped that way for POST_TRADE_APPROVE, which left the Approve Trade button
// dispatching into nothing.
//
// A behavioral spec is not available: these modules import through the `@core`
// webpack alias mocha has no harness for. So this reads the source, like
// test/roster.salary-consumer-contract.spec.mjs.
const creators_re = /create_api_actions\(\s*'([A-Z_0-9]+)'/g
const types_re = /create_api_action_types\(\s*'([A-Z_0-9]+)'/g

const collect = (source, regex) =>
  new Set([...source.matchAll(regex)].map((match) => match[1]))

const find_unregistered_types = (dir) => {
  const offenders = []
  let module_count = 0
  let creator_count = 0

  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) {
        walk(full)
      } else if (entry.name === 'actions.js') {
        const source = fs.readFileSync(full, 'utf8')
        const creators = collect(source, creators_re)
        const types = collect(source, types_re)
        module_count += 1
        creator_count += creators.size

        for (const name of creators) {
          if (!types.has(name)) {
            offenders.push(`${path.relative(core_dir, full)}: ${name}`)
          }
        }
      }
    }
  }

  walk(dir)
  return { offenders, module_count, creator_count }
}

describe('app/core action type registration', function () {
  it('registers the type constants for every api action creator', () => {
    const { offenders, module_count, creator_count } =
      find_unregistered_types(core_dir)

    // A traversal or regex change that matched nothing would otherwise pass
    // this spec forever while checking no module at all.
    module_count.should.be.above(30)
    creator_count.should.be.above(50)
    offenders.should.deep.equal([])
  })
})
