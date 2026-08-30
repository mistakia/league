// Response validation for the test environment: every API response the suite
// produces is validated against the swagger response schema for its operation
// and status, and a mismatch fails the test that produced it.
//
// This is a RATCHET, not a one-shot conform. It went on while ~104 responses
// still mismatched, behind the hold-out list in
// `response-validation-holdout.json`, because enabling it everywhere at once
// means enabling it only after the whole backlog is ground to zero -- and a
// route added in the meantime drifts undetected for exactly as long as that
// takes. Every operation NOT on the list is validated from today.
//
// Two properties make the list a ratchet rather than a mute button, and both
// are load-bearing:
//
//   1. An entry is keyed on (OPERATION, status), never on a route. A route-key
//      would suppress a second operation on the same path -- the exact shape of
//      the `WaiverClaim` trap, where one component schema is the 200 of both
//      `GET /waivers/report` and `POST /waivers` and a repair aimed at one
//      broke the other. `POST /leagues/{leagueId}/waivers` at 200 is held out;
//      `GET /leagues/{leagueId}/waivers` at 200 is not, and neither is that
//      same POST at 400.
//
//   2. An entry that STOPS failing fails the run. That is what forces a repair
//      to remove its own entry instead of leaving a standing exemption behind,
//      and it is the same property the conformance baseline, the alias
//      byte-budget hold-out and every adjudications file in `db/gates` already
//      carry. `assert_holdout_is_current()` below is where it is enforced, from
//      a root `afterAll` hook in `test/global.mjs`.
//
// WHY THE KEY IS `METHOD /path/{param}` AND NOT AN operationId. The ruling said
// `(operationId, status)` and this is that key in all but spelling: the spec
// declares an `operationId` on 3 of its 131 operations, and method-plus-path is
// the OpenAPI-canonical operation identity that an `operationId` is an alias
// for. It is also the stronger of the two, since it cannot be duplicated across
// operations and cannot go stale against the path it names. Adding 128
// operationIds to seed a hold-out list would be spec churn buying nothing, and
// would run straight into the double-definition trap CLAUDE.md records.
//
// WHAT THIS DOES NOT COVER -- read this before reading a shrinking hold-out
// list as growing safety. COVERAGE EQUALS TEST HIT-RATE. The validator only
// ever sees the (operation, status) pairs the suite actually produces, so an
// unexercised route and an error path no test provokes are unchecked no matter
// how empty the list gets. Emptying the list raises the floor under the
// operations the suite already exercises; it says nothing about the ones it
// does not. The teardown report prints the observed pair count for exactly this
// reason -- it is the denominator, and it is the honest number.

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import * as OpenApiValidator from 'express-openapi-validator'

import specs from '#api/swagger/config.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const holdout_file = path.join(__dirname, 'response-validation-holdout.json')

const load_holdout = () => {
  if (!fs.existsSync(holdout_file)) return []
  return JSON.parse(fs.readFileSync(holdout_file, 'utf8'))
}

const holdout_key = ({ operation, status }) => `${operation} ${status}`

// Every (operation, status) pair the suite produced a response for, whether or
// not it validated. This is the denominator, and it is also the blindness
// detector: if the validator ever stops matching requests to the spec -- a
// basePath drift, a mount-order change that puts it after the routes -- then
// nothing is observed, nothing is held, and the suite goes green with the
// ratchet dead. An empty set at teardown fails the run.
//
// It cannot tell that apart from a spec SUBSET that makes no HTTP requests,
// which is a routine way to run mocha here and produces the same empty set. The
// failure text names both causes because the one-sided wording cost a session:
// reading "the validator is not reaching requests at all" off a data-views
// subset run, it went looking for a stale hold-out entry, and the two entries it
// landed on were live -- deleting them turns five tests red with 500s. The check
// stays unconditional; only the message distinguishes.
const observed_pairs = new Set()

// Every request that reached the app, whether or not the validator could place
// it in the spec. This is what separates the two causes above, and it works
// because it is counted by OUR middleware, ahead of the validator's own: a
// validator that has stopped matching requests still increments this, while a
// subset that issues no HTTP request cannot. Zero requests means the run had no
// way to judge validator reachability at all, which is a different statement
// from "the validator is not reaching requests".
//
// It does NOT cover the whole blindness case on its own: if this middleware
// stops being mounted in api/index.mjs, the counter stays 0 and the teardown
// falls silent. That half is held by the fourth case in
// test/api.response-validation-ratchet.spec.mjs, which drives a documented
// route on the real server and asserts a pair is observed.
let request_count = 0

// Pairs where the validator DID raise and a hold-out entry swallowed it. An
// entry with no hit here, whose pair was nonetheless observed, is reported
// stale -- and that inference only holds for a FULL run. One (operation,
// status) can have several response shapes and the entry is held by the FAILING
// one, so a subset exercising only the conformant shape reports a live entry as
// stale. Measured: test/trade.spec.mjs alone calls
// POST /api/leagues/{leagueId}/trades 200 stale; adding trade-veto,
// league-pause and draft-pick-expiry clears it with the entry untouched. The
// failure text says so, because deleting on that report turns the full suite
// red.
const held_pairs = new Map()

const operation_key = (req) => {
  const openapi = req.openapi
  if (!openapi || !openapi.openApiRoute) return null
  return `${req.method.toUpperCase()} ${openapi.openApiRoute}`
}

// `req.openapi` is populated by the validator's own metadata middleware, which
// runs after this one -- hence reading it on `finish` rather than inline.
const record_observed_middleware = (req, res, next) => {
  request_count += 1
  res.on('finish', () => {
    const operation = operation_key(req)
    if (operation) observed_pairs.add(`${operation} ${res.statusCode}`)
  })
  next()
}

// Every failure discovery mode saw, keyed the same way, with the distinct
// validator messages behind each key. Only populated under discovery.
const discovered = new Map()

// Seeding the list needs one run where nothing throws, or the first 500 aborts
// the request chain and hides every failure behind it. This is that run --
// and it CANNOT be used to make a red suite green, because
// `assert_holdout_is_current()` fails unconditionally whenever it is set. Its
// only output is a proposed hold-out list on stdout.
//
//   LEAGUE_RESPONSE_VALIDATION_DISCOVER=1 yarn test:local
const is_discovery_mode = () =>
  process.env.LEAGUE_RESPONSE_VALIDATION_DISCOVER === '1'

const create_on_error = (holdout) => {
  const held_out = new Set(holdout.map(holdout_key))

  // The validator calls this from inside its own catch. Returning normally
  // swallows the failure and the ORIGINAL response body goes out unchanged;
  // rethrowing gives the caller a 500, which is what fails the test. So this
  // function is the whole enforcement point.
  return (error, body, req) => {
    const operation = operation_key(req)
    // No operation means the validator could not place the request in the spec,
    // which no hold-out entry can name. Let it through as a failure.
    if (!operation) throw error

    const key = `${operation} ${req.res.statusCode}`

    if (is_discovery_mode()) {
      if (!discovered.has(key)) discovered.set(key, new Set())
      for (const message of validation_messages(error)) {
        discovered.get(key).add(message)
      }
      return
    }

    if (!held_out.has(key)) throw error

    held_pairs.set(key, (held_pairs.get(key) || 0) + 1)
  }
}

// The validator's `errors` carry an array index in `instancePath` for a list
// response (`/3/esbid`), which would read as a different message per row. Index
// segments are collapsed so a message class counts once.
const validation_messages = (error) => {
  const errors = error.errors || []
  if (!errors.length) return [error.message]
  return errors.map((item) => {
    const instance_path = (item.path || '').replace(/\/\d+(?=\/|$)/g, '/*')
    return `${instance_path || '/'} ${item.message}`
  })
}

export const is_response_validation_enabled = () =>
  process.env.NODE_ENV === 'test'

// `validateRequests` stays OFF. This gates what the server EMITS against what
// it documents; turning on request validation would additionally reject callers
// the routes currently accept, which is a behavior change rather than a check.
// `ignoreUndocumented` keeps an undocumented route silent rather than 500ing
// it -- an undocumented route is a docs gap for `check-api-response-shapes`,
// not a response defect.
export const create_response_validation_middleware = () => {
  const holdout = load_holdout()
  return [
    record_observed_middleware,
    ...OpenApiValidator.middleware({
      apiSpec: specs,
      validateRequests: false,
      validateResponses: { onError: create_on_error(holdout) },
      validateSecurity: false,
      ignoreUndocumented: true
    })
  ]
}

export const get_response_validation_report = () => {
  const holdout = load_holdout()
  const stale = []
  const not_exercised = []

  for (const entry of holdout) {
    const key = holdout_key(entry)
    if (held_pairs.has(key)) continue
    // Staleness is only meaningful for an entry this run could have exercised.
    // A single-file mocha run observes a handful of pairs and would otherwise
    // report every other entry as stale, whose documented remedy -- delete the
    // entry -- reopens findings that are live. Same NOT EXERCISED bucket as
    // `check-retyped-column-arithmetic`.
    if (observed_pairs.has(key)) stale.push(entry)
    else not_exercised.push(entry)
  }

  return {
    holdout_total: holdout.length,
    observed_pair_count: observed_pairs.size,
    request_count,
    held: [...held_pairs.entries()].map(([key, count]) => ({ key, count })),
    stale,
    not_exercised
  }
}

// Captured at module load, which is before any spec runs. Reading the clock in
// the teardown hook instead dates every entry to whatever the last spec's
// `MockDate.set` left behind -- the first seeding run stamped 2026-09-01 on a
// list built on 2026-08-18.
const real_today = new Date().toISOString().slice(0, 10)

const print_discovery_proposal = () => {
  const today = real_today
  const proposal = [...discovered.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, messages]) => {
      const last_space = key.lastIndexOf(' ')
      return {
        operation: key.slice(0, last_space),
        status: Number(key.slice(last_space + 1)),
        added: today,
        messages: [...messages].sort()
      }
    })
  console.log('')
  console.log('=== RESPONSE VALIDATION DISCOVERY ===')
  console.log(
    `${proposal.length} failing (operation, status) pairs. Proposed contents ` +
      'of api/swagger/response-validation-holdout.json:'
  )
  console.log(JSON.stringify(proposal, null, 2))
}

export const assert_holdout_is_current = () => {
  const report = get_response_validation_report()
  const failures = []

  // Discovery mode swallows every failure, so nothing else this function checks
  // means anything. It fails the run unconditionally so a red suite can never
  // be made green by setting the variable.
  if (is_discovery_mode()) {
    print_discovery_proposal()
    throw new Error(
      'LEAGUE_RESPONSE_VALIDATION_DISCOVER=1 was set. Every response ' +
        'validation failure was swallowed, so this run proves nothing about ' +
        'the suite. The proposed hold-out list is printed above; unset the ' +
        'variable and run again.'
    )
  }

  // No request reached the app at all. Such a run cannot observe a pair and
  // cannot judge validator reachability either way, so there is nothing here to
  // be current or stale ABOUT. Failing it was the single largest source of
  // false red in this suite: every ad-hoc single-spec run reported "1 failing"
  // on a spec that passed, which teaches every reader, human and agent, that a
  // red suite is noise. Announce, do not fail.
  if (!report.request_count) {
    console.log(
      '\nresponse validation hold-out NOT CHECKED -- this run served zero HTTP ' +
        'requests, so it observed no (operation, status) pairs and cannot ' +
        'judge the hold-out list or validator reachability. Run the full suite ' +
        'for that verdict.'
    )
    return report
  }

  if (report.holdout_total && !report.observed_pair_count) {
    failures.push(
      'Response validation observed ZERO (operation, status) pairs across the ' +
        `${report.request_count} request(s) this run served, while the ` +
        `hold-out list carries ${report.holdout_total} entries. Every entry ` +
        'would otherwise read as merely NOT EXERCISED, which is silent.\n\n' +
        'Requests WERE served and none of them could be placed in the spec, ' +
        'so this is the blindness case the guard exists for -- not a subset ' +
        'artifact, which serves no requests at all and is now reported rather ' +
        'than failed. Check that the validator middleware is mounted BEFORE ' +
        'the route mounts in api/index.mjs and that the spec servers basePath ' +
        "still matches the routes' mount path.\n\n" +
        'Do NOT edit the hold-out list to silence this. Its entries are ' +
        'unexercised here, not stale, and deleting a live one turns the full ' +
        'suite red.'
    )
  }

  if (report.stale.length) {
    failures.push(
      `${report.stale.length} stale hold-out entr${
        report.stale.length === 1 ? 'y' : 'ies'
      }: the suite produced this (operation, status) and the response VALIDATED.\n` +
        report.stale
          .map((entry) => `  ${holdout_key(entry)}  (added ${entry.added})`)
          .join('\n') +
        '\n\nIN A FULL RUN that means the defect is repaired: delete the entry ' +
        'from api/swagger/response-validation-holdout.json in the same commit ' +
        'as the repair.\n\n' +
        'IN A SPEC SUBSET it usually means the opposite, so check which you ran ' +
        'before deleting anything. One (operation, status) pair can have more ' +
        'than one response shape, and an entry is held by the FAILING one. A ' +
        'subset that exercises only the conformant shape reports the entry ' +
        'stale while the full suite holds it, and deleting it then turns the ' +
        'full suite red. Measured: test/trade.spec.mjs alone reports ' +
        'POST /api/leagues/{leagueId}/trades 200 stale, and adding the other ' +
        'specs that post a trade -- trade-veto, league-pause, ' +
        'draft-pick-expiry -- clears it with the entry untouched.\n\n' +
        'So confirm against a full run, or against every spec that exercises ' +
        'the operation, before treating an entry here as spent.'
    )
  }

  if (failures.length) {
    throw new Error(
      `Response validation hold-out is out of date.\n\n${failures.join('\n\n')}`
    )
  }

  return report
}

export const print_response_validation_report = (report) => {
  const remaining = report.holdout_total - report.held.length
  console.log('')
  console.log('response validation (test env only)')
  console.log(
    `  observed ${report.observed_pair_count} (operation, status) pairs -- ` +
      'this is the coverage denominator. Validation reaches only what the ' +
      'suite exercises: an unexercised route and an error path no test ' +
      'provokes stay unchecked however small the hold-out gets. A floor, not ' +
      'a contract.'
  )
  console.log(
    `  hold-out: ${report.holdout_total} entries, ${report.held.length} hit ` +
      `this run, ${remaining} not exercised`
  )
}
