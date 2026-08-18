/* global describe it before */

import * as chai from 'chai'
import path from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { Record } from 'immutable'

import {
  record_backed_domains,
  record_factories_in,
  store_keys_in_reducer
} from './webpack-resolve/record-store-keys.mjs'

const expect = chai.expect
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const core_directory = path.resolve(__dirname, '../app/core')

// The gate CLAUDE.md names and did not have: each wire-built Record DECLARES
// the id its reducer keys on, three ways -- declaration, factory destructure,
// constructor call.
//
// `test/app.retired-uid-identifier.spec.mjs` is the other half and is a source
// scan, so it matches READS of a retired name and is structurally blind to a
// Record that declares NEITHER spelling. That is exactly the state
// `46fdd72c6` left six Records in: an Immutable Record silently drops what it
// does not declare, so `league.league_id` was `undefined` at all ten read
// sites, the sidebar rendered "League not connected", and the draft saga
// requested `/api/leagues/undefined/draft`. The suite read an identical 4185
// passing at the broken revision and at the fix.
//
// This spec closes that by LOADING the Record rather than reading its text --
// which `test/webpack-resolve/register.mjs` makes possible for the first time.
// A Record whose declaration is missing a key is then not a string that is
// absent from a file; it is a constructed instance that does not carry the
// field, which is the same observable the browser has.
//
// The reducer side stays a source scan on purpose. A reducer keying on a
// nonexistent id writes that id literally, so it is not blind in the way the
// Record side is -- and the cross-check between a scanned reducer key and a
// LOADED Record declaration is what makes the pair a gate.

const SENTINEL = 987654321

const load_domains = async () => {
  const domains = record_backed_domains(core_directory)

  return Promise.all(
    domains.map(async (domain) => {
      const factories = record_factories_in(domain.record_path)
      const factory_names = new Set(factories.map((factory) => factory.name))
      const module = await import(pathToFileURL(domain.record_path).href)

      // The Record CLASS among the module's exports. Immutable's factory is a
      // constructible function, so it is identified by constructing one rather
      // than by name.
      const record_class = Object.values(module).find((Exported) => {
        if (typeof Exported !== 'function') return false
        try {
          return Record.isRecord(new Exported())
        } catch {
          return false
        }
      })

      return {
        ...domain,
        module,
        record_class,
        factories,
        declared_ids: [...new Set(factories.flatMap((f) => f.ids))],
        store_keys: store_keys_in_reducer(domain.reducer_path, factory_names)
      }
    })
  )
}

describe('app/core Record declares the id its reducer keys on', function () {
  let domains

  before(async function () {
    domains = await load_domains()
  })

  // A resolution or DOM regression that stopped these modules loading would
  // otherwise make every assertion below vacuous -- the loop would simply
  // iterate nothing and the spec would pass over a completely broken tree.
  it('reaches every app/core domain that has both a reducer and a Record', function () {
    expect(domains.length).to.be.at.least(10)

    const unloadable = domains.filter((domain) => !domain.record_class)
    expect(
      unloadable.map((domain) => domain.name),
      'every Record module must load and export a Record class'
    ).to.deep.equal([])
  })

  it('declares every entity id its own wire factory destructures', function () {
    const findings = []

    for (const domain of domains) {
      if (!domain.record_class) continue
      const RecordClass = domain.record_class
      const declared_fields = new Set(Object.keys(new RecordClass().toJS()))

      for (const id of domain.declared_ids) {
        if (!declared_fields.has(id)) {
          findings.push(
            `${domain.name}: the factory destructures ${id}, which the Record does not declare`
          )
        }
      }
    }

    expect(findings).to.deep.equal([])
  })

  // The factory is an independent enumeration of the field list -- it
  // destructures explicitly and then names each key again in the constructor
  // call -- so a field can be declared on the Record and still dropped between
  // the wire and the store. Calling it is the only thing that tells those
  // apart.
  it('carries every such id through the factory and through the constructor', function () {
    const findings = []

    for (const domain of domains) {
      if (!domain.record_class) continue
      const RecordClass = domain.record_class

      for (const id of domain.declared_ids) {
        const constructed = new RecordClass({ [id]: SENTINEL })
        if (constructed.get(id) !== SENTINEL) {
          findings.push(`${domain.name}: new Record dropped ${id}`)
        }

        for (const factory of domain.factories) {
          if (!factory.ids.includes(id)) continue
          const built = domain.module[factory.name]({ [id]: SENTINEL })
          if (built.get(id) !== SENTINEL) {
            findings.push(`${domain.name}: ${factory.name}() dropped ${id}`)
          }
        }
      }
    }

    expect(findings).to.deep.equal([])
  })

  // The half that catches a reducer keying the store on a foreign entity's id.
  // `state.setIn(['items', t.team_id], create_trade(t))` reads an id off an
  // object it simultaneously declares to be a trade, and `team_id` is a column
  // the trades wire has never carried -- so every trade collapsed onto one
  // `undefined` key.
  it('declares every entity id its reducer keys the store on', function () {
    const findings = []
    let checked = 0

    for (const domain of domains) {
      if (!domain.record_class) continue

      // A factory that destructures no entity id is not keyed by an id of its
      // own -- a Season is built FROM a league object -- so its reducer's keys
      // belong to another entity and this domain is out of reach here.
      if (!domain.declared_ids.length) continue

      const RecordClass = domain.record_class
      const declared_fields = new Set(Object.keys(new RecordClass().toJS()))

      for (const key of domain.store_keys) {
        if (!key.is_domain_wire_object) continue
        checked++
        if (!declared_fields.has(key.id)) {
          findings.push(
            `${domain.name}/reducer.js:${key.line}: keys the store on ${key.object}.${key.id}, which the ${RecordClass.name || 'Record'} does not declare`
          )
        }
      }
    }

    expect(findings).to.deep.equal([])

    // Same reason as the roster floor above: an extraction that stopped
    // resolving wire objects would report a clean tree rather than no tree.
    expect(
      checked,
      'store keys resolved to a domain wire object'
    ).to.be.at.least(8)
  })
})
