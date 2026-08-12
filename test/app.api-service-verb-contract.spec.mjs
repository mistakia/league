/* global describe it */
import * as chai from 'chai'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const service_path = path.join(__dirname, '../app/core/api/service.js')

chai.should()

// `api_request` merges an api function's return value FLAT into the fetch
// options and calls `fetch(options.url, options)`, so `method` has to be a
// top-level key. Nested under anything -- `{ url, opts: { method: 'POST' } }`
// -- it is ignored and the request silently goes out as a GET. Nothing catches
// that: it is valid JavaScript, eslint is happy, the build succeeds, and the
// only symptom is a 404 from a route that only answers POST.
//
// A behavioral spec is not available here, because service.js imports
// `@core/constants` through a webpack alias mocha has no harness for. So this
// reads the source, in the manner of
// test/roster.salary-consumer-contract.spec.mjs.
const entry_re = /\n {2}([a-z_0-9]+)\(([^)]*)\)\s*\{(.*?)\n {2}\},/gs

const find_entries_missing_a_verb = (source) => {
  const offenders = []
  let entry_count = 0

  for (const match of source.matchAll(entry_re)) {
    const [, name, , body] = match
    if (!body.includes('return {')) continue
    entry_count += 1

    const is_writing_request = ['post_', 'put_', 'delete_'].some((prefix) =>
      name.startsWith(prefix)
    )
    if (!is_writing_request) continue

    const returned = body.slice(body.indexOf('return {'))
    const spreads_a_verb = /\.\.\.(POST|PUT|DELETE)\b/.test(returned)
    const declares_a_verb = /return \{[^{}]*\bmethod:/.test(returned)

    if (!spreads_a_verb && !declares_a_verb) offenders.push(name)
  }

  return { offenders, entry_count }
}

describe('app/core/api/service.js verb contract', function () {
  it('gives every writing request a top-level method', () => {
    const source = fs.readFileSync(service_path, 'utf8')
    const { offenders, entry_count } = find_entries_missing_a_verb(source)

    // A resolution or formatting change that matched nothing would otherwise
    // pass this spec forever while checking no entry at all.
    entry_count.should.be.above(50)
    offenders.should.deep.equal([])
  })

  it('reports a method nested where the merge cannot see it', () => {
    // The positive control. `method` appears in the nested form too, so a check
    // that only greps for the word passes over the defect it exists to catch --
    // this asserts the check discriminates on POSITION, not on presence.
    const source = fs.readFileSync(service_path, 'utf8')
    const broken = source.replace(
      /( {2}post_veto_trade\([^)]*\)\s*\{\n {4}const url[^\n]*\n {4}return \{ url), \.\.\.POST\(\{\}\)( \})/,
      "$1, opts: { method: 'POST' }$2"
    )
    broken.should.not.equal(source)

    const { offenders } = find_entries_missing_a_verb(broken)
    offenders.should.deep.equal(['post_veto_trade'])
  })
})
