/* global describe it beforeEach */

import * as chai from 'chai'
import { Map, List, fromJS } from 'immutable'

import { User } from '@core/app/user'
import {
  build_redux_snapshot,
  enforce_context_budget,
  REDUX_SNAPSHOT_ALLOWLIST,
  CONTEXT_DROP_ORDER,
  MAXIMUM_CONTEXT_BYTES
} from '@core/contribution-context'
import {
  record_breadcrumb,
  get_breadcrumbs,
  clear_breadcrumbs,
  BREADCRUMB_LIMIT
} from '@core/contribution-breadcrumbs'
import {
  decoded_byte_length,
  capture_screenshot,
  SCREENSHOT_QUALITY_LADDER,
  MAXIMUM_SCREENSHOT_BYTES
} from '@core/contribution-screenshot'

const expect = chai.expect

// The three capture surfaces added by the contribution dialog each read from a
// store that holds a live session JWT and the submitter's email address. This
// is the population-level check that their allowlists actually compose --
// asserted here rather than in a browser, because a credential leak is exactly
// the class that must fail a gate rather than an eyeball.

const SEEDED_TOKEN =
  'eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOjQyfQ.this-is-a-fake-session-token'
const SEEDED_EMAIL = 'submitter@example.com'

// Mirrors the real `app` record's shape, built from the REAL User record
// (app/core/app/user.js) so the email lives exactly where the reducer puts it.
// The app reducer itself cannot be imported here -- it reaches `window`
// transitively, which is the module-format wall documented in docs/guides/
// spa.md, and jsdom does not move it.
const build_seeded_state = (extra_app_fields = {}) =>
  Map({
    app: Map({
      token: SEEDED_TOKEN,
      user: new User({ id: 42, username: 'submitter', email: SEEDED_EMAIL }),
      userId: 42,
      clientId: 'f2b1c0de-0000-4000-8000-000000000000',
      year: 2026,
      teamId: 7,
      leagueId: 1,
      teamIds: new List([7]),
      selected_data_view_id: 'view-abc',
      selected_plays_view_id: 'plays-abc',
      ...extra_app_fields
    }),
    websocket: Map({ is_connected: true }),
    api: Map({
      request_history: Map({ GET_TEAMS_1_2026: true, GET_DATA_VIEWS: true })
    })
  })

describe('contribution capture surfaces', function () {
  describe('the redux snapshot allowlist', function () {
    it('the fixture actually carries the credentials it claims to', function () {
      // ANTI-VACUITY CONTROL. Every assertion below is a NEGATIVE -- "the
      // output does not contain X" -- and a negative passes trivially against a
      // fixture that never held X. This proves the input really is the
      // dangerous one before anything concludes from its absence.
      const state = build_seeded_state()
      const serialized_input = JSON.stringify(state.toJS())
      expect(serialized_input).to.include(SEEDED_TOKEN)
      expect(serialized_input).to.include(SEEDED_EMAIL)
    })

    it('does not carry the session token', function () {
      const snapshot = build_redux_snapshot(build_seeded_state())
      expect(JSON.stringify(snapshot)).to.not.include(SEEDED_TOKEN)
      expect(snapshot.app).to.not.have.property('token')
    })

    it('does not carry an email-shaped string', function () {
      const snapshot = build_redux_snapshot(build_seeded_state())
      const serialized = JSON.stringify(snapshot)
      expect(serialized).to.not.include(SEEDED_EMAIL)
      // Shape-based rather than value-based, so a DIFFERENT email reaching the
      // snapshot by some other path fails this too.
      expect(serialized).to.not.match(/[\w.+-]+@[\w-]+\.[\w.]+/)
    })

    it('does not carry the user record at all', function () {
      const snapshot = build_redux_snapshot(build_seeded_state())
      expect(snapshot.app).to.not.have.property('user')
    })

    it('emits exactly the allowlisted app fields and nothing else', function () {
      const snapshot = build_redux_snapshot(build_seeded_state())
      expect(Object.keys(snapshot.app).sort()).to.deep.equal(
        [...REDUX_SNAPSHOT_ALLOWLIST.app].sort()
      )
    })

    it('a new field on the app record is absent until it is allowlisted', function () {
      // The governing property. A blacklist would ship this field the moment it
      // landed; the allowlist drops it until someone names it.
      const state = build_seeded_state({
        newly_added_sensitive_field: 'should-never-ship'
      })
      const snapshot = build_redux_snapshot(state)
      expect(JSON.stringify(snapshot)).to.not.include('should-never-ship')
      expect(snapshot.app).to.not.have.property('newly_added_sensitive_field')
    })

    it('drops an allowlisted field that unexpectedly holds an object', function () {
      // A field changing shape must not widen the capture.
      const state = build_seeded_state({
        teamId: fromJS({ nested: 'unexpected-object' })
      })
      const snapshot = build_redux_snapshot(state)
      expect(JSON.stringify(snapshot)).to.not.include('unexpected-object')
    })

    it('names no credential-bearing field in the allowlist itself', function () {
      // A static guard, so a future edit that adds `token` or `user` to the
      // allowlist fails here rather than in production.
      const every_field = Object.values(REDUX_SNAPSHOT_ALLOWLIST).flatMap(
        (fields) => [...fields]
      )
      expect(every_field).to.not.include('token')
      expect(every_field).to.not.include('user')
      expect(every_field).to.not.include('email')
      expect(every_field).to.not.include('authError')
    })

    it('carries request-history KEYS without their values', function () {
      const snapshot = build_redux_snapshot(build_seeded_state())
      expect(snapshot.api.request_history_keys).to.deep.equal([
        'GET_TEAMS_1_2026',
        'GET_DATA_VIEWS'
      ])
    })

    it('returns null rather than throwing on a state it cannot read', function () {
      expect(build_redux_snapshot(null)).to.equal(null)
      expect(build_redux_snapshot({})).to.equal(null)
    })
  })

  describe('the action breadcrumb buffer', function () {
    beforeEach(function () {
      clear_breadcrumbs()
    })

    it('records the type and timestamp of an action', function () {
      record_breadcrumb({ type: 'LOAD_TEAMS', payload: {} })
      const [entry] = get_breadcrumbs()
      expect(entry.type).to.equal('LOAD_TEAMS')
      expect(entry.at).to.be.a('number')
    })

    it('records no payload field from a LOGIN action', function () {
      // The action that makes this matter: the auth payloads carry a plaintext
      // password and, on FULFILLED, the session token.
      record_breadcrumb({
        type: 'LOGIN',
        payload: { password: 'hunter2-plaintext', username: 'submitter' }
      })
      record_breadcrumb({
        type: 'LOGIN_FULFILLED',
        payload: {
          data: { token: SEEDED_TOKEN, user: { email: SEEDED_EMAIL } }
        }
      })

      const serialized = JSON.stringify(get_breadcrumbs())
      expect(serialized).to.not.include('hunter2-plaintext')
      expect(serialized).to.not.include(SEEDED_TOKEN)
      expect(serialized).to.not.include(SEEDED_EMAIL)

      for (const entry of get_breadcrumbs()) {
        expect(Object.keys(entry)).to.not.include('payload')
      }
    })

    it('carries only type, at and an allowlisted scalar detail', function () {
      record_breadcrumb({
        type: '@@router/LOCATION_CHANGE',
        payload: { location: { pathname: '/data-views', state: { secret: 1 } } }
      })
      const [entry] = get_breadcrumbs()
      expect(Object.keys(entry).sort()).to.deep.equal(['at', 'detail', 'type'])
      expect(entry.detail).to.equal('/data-views')
    })

    it('adds no detail for a type with no declared extractor', function () {
      record_breadcrumb({
        type: 'GET_ROSTERS_FULFILLED',
        payload: { data: { players: ['a', 'b'] } }
      })
      const [entry] = get_breadcrumbs()
      expect(entry).to.not.have.property('detail')
    })

    it('stays bounded under a flood and keeps the most recent', function () {
      for (let index = 0; index < BREADCRUMB_LIMIT * 3; index++) {
        record_breadcrumb({ type: `ACTION_${index}` })
      }
      const breadcrumbs = get_breadcrumbs()
      expect(breadcrumbs).to.have.length(BREADCRUMB_LIMIT)
      expect(breadcrumbs[breadcrumbs.length - 1].type).to.equal(
        `ACTION_${BREADCRUMB_LIMIT * 3 - 1}`
      )
    })

    it('tail matches a sequence of navigations', function () {
      for (const pathname of ['/data-views', '/plays', '/leagues/1']) {
        record_breadcrumb({
          type: '@@router/LOCATION_CHANGE',
          payload: { location: { pathname } }
        })
      }
      expect(get_breadcrumbs().map((entry) => entry.detail)).to.deep.equal([
        '/data-views',
        '/plays',
        '/leagues/1'
      ])
    })

    it('ignores an action with no string type', function () {
      record_breadcrumb({ payload: {} })
      record_breadcrumb(null)
      expect(get_breadcrumbs()).to.have.length(0)
    })

    it('hands back a copy the caller cannot use to mutate the buffer', function () {
      record_breadcrumb({ type: 'LOAD_TEAMS' })
      get_breadcrumbs().push({ type: 'INJECTED' })
      expect(get_breadcrumbs()).to.have.length(1)
    })
  })

  describe('the captured-context byte budget', function () {
    it('leaves a context under budget untouched', function () {
      const context = {
        route: { pathname: '/plays' },
        redux_snapshot: { app: { year: 2026 } }
      }
      const result = enforce_context_budget(context)
      expect(result).to.deep.equal(context)
      expect(result).to.not.have.property('dropped_components')
    })

    it('drops the redux snapshot first and names it', function () {
      const context = {
        route: { pathname: '/data-views' },
        redux_snapshot: { blob: 'x'.repeat(MAXIMUM_CONTEXT_BYTES + 1000) },
        data_view: { canonical_url: 'https://xo.football/data-views' }
      }
      const result = enforce_context_budget(context)
      expect(result).to.not.have.property('redux_snapshot')
      expect(result.dropped_components).to.deep.equal(['redux_snapshot'])
      // A truncated capture is VISIBLY truncated -- the surviving components
      // stay, so triage can tell "dropped" from "never captured".
      expect(result.data_view).to.deep.equal({
        canonical_url: 'https://xo.football/data-views'
      })
    })

    it('drops further components in the declared order', function () {
      const oversized = 'x'.repeat(MAXIMUM_CONTEXT_BYTES)
      const context = {
        route: { pathname: '/plays' },
        redux_snapshot: { blob: oversized },
        data_view: { blob: oversized },
        action_breadcrumbs: [{ type: 'LOAD_TEAMS', at: 1 }]
      }
      const result = enforce_context_budget(context)
      expect(result.dropped_components).to.deep.equal(
        CONTEXT_DROP_ORDER.slice(0, result.dropped_components.length)
      )
      expect(result.route).to.deep.equal({ pathname: '/plays' })
    })

    it('skips a component that is already absent rather than naming it', function () {
      const context = {
        route: { pathname: '/plays' },
        redux_snapshot: null,
        data_view: { blob: 'x'.repeat(MAXIMUM_CONTEXT_BYTES + 1000) }
      }
      const result = enforce_context_budget(context)
      expect(result.dropped_components).to.deep.equal(['data_view'])
    })

    // THE SCREENSHOT IS NOT IN THIS BUDGET AT ALL, and that is the contract
    // this case pins. It travels as its own top-level submission field into
    // contribution_screenshots as bytea; a base64 image inside a JSONB column
    // with a 262144-byte ceiling would lose the drop race to the redux
    // snapshot every time it mattered.
    it('does not treat the screenshot as a droppable context component', function () {
      expect(CONTEXT_DROP_ORDER).to.not.include('screenshot')
    })
  })

  describe('the screenshot budget', function () {
    // The budget is stated in DECODED bytes because that is what the bytea
    // column stores and what its check constraint bounds. Measuring the data
    // URI string instead would refuse images a third smaller than the stated
    // ceiling, so this is the arithmetic the ceiling depends on.
    it('measures decoded bytes rather than data URI characters', function () {
      const payload = Buffer.from('a'.repeat(3000)).toString('base64')
      expect(decoded_byte_length(`data:image/jpeg;base64,${payload}`)).to.equal(
        3000
      )
    })

    it('accounts for base64 padding on both remainders', function () {
      // One and two padding characters respectively, which is where an
      // unpadded length calculation goes wrong.
      const one_over = Buffer.from('x'.repeat(3001)).toString('base64')
      const two_over = Buffer.from('x'.repeat(3002)).toString('base64')
      expect(
        decoded_byte_length(`data:image/jpeg;base64,${one_over}`)
      ).to.equal(3001)
      expect(
        decoded_byte_length(`data:image/jpeg;base64,${two_over}`)
      ).to.equal(3002)
    })

    it('reports zero for a string that is not a data URI', function () {
      expect(decoded_byte_length('not-a-data-uri')).to.equal(0)
    })

    it('falls in quality rather than rising', function () {
      const descending = [...SCREENSHOT_QUALITY_LADDER].sort((a, b) => b - a)
      expect(SCREENSHOT_QUALITY_LADDER).to.deep.equal(descending)
      expect(MAXIMUM_SCREENSHOT_BYTES).to.be.above(0)
    })

    // DEGRADE, NEVER THROW is the contract the whole capture path holds to: a
    // report that fails to send because its screenshot could not be rendered
    // is strictly worse than a report with no screenshot. There is no canvas
    // in Node, so this run exercises the failure arm specifically -- which is
    // the arm that matters, since it is the one that must not propagate.
    it('returns null instead of throwing when the page cannot be rendered', async function () {
      expect(await capture_screenshot()).to.equal(null)
    })
  })
})
