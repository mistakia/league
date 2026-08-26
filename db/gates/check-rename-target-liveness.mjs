#!/usr/bin/env node

// Target-liveness gate for the data-view rename registry.
//
// WHAT IT CATCHES. Every record in the unified data-view
// RENAME_REGISTRY declares `from -> to`. A `to` (or, for a param key, the
// TERMINAL its chain resolves to) that is not a key any reader carries means a
// saved view / short URL naming the old spelling gets its filter silently
// dropped, or rendered blank -- the class that blanked three real server-bound
// rewrites (pru_ngs -> pru, route_ngs -> route, qb_pressure_ngs ->
// qb_pressure_tracking) whose targets went dead while the old direct copy in
// private/ stopped being updated. Those three were fixed by folding that copy
// into the registry; this gate makes the CLASS mechanically checkable so a
// future stale `to` fails here the moment it lands, instead of as a
// user-reported wrong column value.
//
// RESOLUTION NOT RAW TARGET. A `to` that is itself a `from` of a later record
// is a legitimate CHAIN (route_ngs -> route -> charted_route), so the gate
// follows each param_key record's chain to its terminal and asserts THAT is
// live -- asserting the raw `to` would forbid a legal chain and go red on
// correct input. That is why the three signals above are caught by THIS class
// only when their chain dead-ends, which is the corruption that actually
// breaks reads.
//
// SCOPE. Hard liveness is asserted for the three levels whose target is a
// member of a known live set:
//   param_key   terminal must be a live nfl_plays/ADP registry key
//   column_id   `to` must be a live data-view-fields-index id
//   rate_type   `to` must be a canonical RATE_TYPE_TO_OUTPUT token
// table_state, scoring_format (hash -> slug where the slug is pinned by the
// naming catalog) and the dvoa_type value map (covered by its own spec) are
// deliberately OUT of this gate's hard set; each has its own dedicated oracle
// (test/data-views.table-state-renames.spec.mjs, the scoring spec, and
// test/data-views.dvoa-type-value-migration.spec.mjs).
//
// EXIT ORACLE: 0 = every declared target resolves live, the negative control
// fired, and the decoy held; 1 = a dead target, a control that did not fire, or
// a decoy that did.
//
// CLI: `node db/gates/check-rename-target-liveness.mjs`

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import { format_negative_controls } from './negative-control.mjs'

const repo_root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..'
)

const main = async () => {
  const migration =
    await import('#libs-shared/data-views-saved-view-migration.mjs')
  const plays = (await import('#libs-shared/nfl-plays-column-params.mjs'))
    .default
  const { nfl_games_params } =
    await import('#libs-shared/nfl-plays-column-params.mjs')
  const data_view_fields_index = (
    await import('#libs-shared/data-view-fields-index.mjs')
  ).default
  const { RATE_TYPE_TO_OUTPUT } =
    await import('#libs-shared/data-views-output-tokens.mjs')

  const { RENAME_REGISTRY, PARAM_KEY_RENAMES } = migration

  // The live param-key registry. `number_quarterback` (the ADP table's) is the
  // one target not on nfl_plays; its registry lives in an app/ module that
  // imports extensionless paths and so is read from source, exactly as the
  // migration spec does.
  const live_params = new Set([
    ...Object.keys(plays),
    ...Object.keys(nfl_games_params)
  ])
  const adp_source = fs.readFileSync(
    path.join(
      repo_root,
      'app/core/data-views-fields/player-adp-table-fields.js'
    ),
    'utf8'
  )
  const is_adp_param = (name) =>
    new RegExp(`^\\s{4}${name}: \\{$`, 'm').test(adp_source)
  const is_live_param = (name) => live_params.has(name) || is_adp_param(name)

  // Resolves a legacy param key through the ordered rename chain to its
  // terminal (the name the registry carries today after every hop).
  const terminal = (from) => {
    let current = from
    const seen = new Set()
    while (Object.hasOwn(PARAM_KEY_RENAMES, current) && !seen.has(current)) {
      seen.add(current)
      current = PARAM_KEY_RENAMES[current]
    }
    return current
  }

  const findings = []

  // A resolver over a supplied set of records + the real registry, factored so
  // both the real check and the controls can run the same logic. Records carry
  // the level so the decoy can reuse the param-key path.
  const check_records = ({ records, live }) => {
    const dead = []
    for (const batch of records) {
      for (const [from, to] of Object.entries(batch.records)) {
        if (batch.level === 'param_key') {
          if (to === undefined) continue // table_state nested shape has no flat `to`
          // Resolve the record's TO through the chain, not its FROM: for a
          // record `from -> to`, terminal(to) === terminal(from) (the `to` is
          // the next hop), and the literal contract the gate names is "every
          // registry `to` target resolves to a live key".
          const term = terminal(to)
          if (!live(term)) dead.push(`${batch.id}.${from} -> ${term}`)
        } else if (batch.level === 'column_id') {
          if (!Object.hasOwn(data_view_fields_index, to)) {
            dead.push(`${batch.id}.${from} -> ${to}`)
          }
        } else if (batch.level === 'rate_type') {
          if (!Object.hasOwn(RATE_TYPE_TO_OUTPUT, to)) {
            dead.push(`${batch.id}.${from} -> ${to}`)
          }
        }
      }
    }
    return dead
  }

  const real_records = RENAME_REGISTRY.filter((batch) =>
    ['param_key', 'column_id', 'rate_type'].includes(batch.level)
  ).filter((batch) => batch.id !== 'LEGACY_OUTPUT')
  findings.push(
    ...check_records({ records: real_records, live: is_live_param })
  )

  if (findings.length) {
    console.log('\nGATE FAIL: registry target(s) do not resolve to a live key')
    for (const finding of findings) console.log(`  ${finding}`)
    console.log(
      '\nA stale target drops a filter silently (param key) or renders a blank\n' +
        'cell (column id). Fix the registry `to` to a live name, or, if the\n' +
        'target is a legitimate chain midpoint, make sure it resolves live.'
    )
  } else {
    console.log(
      `\nGATE OK. Every declared target of ${real_records.length} registry batch(es)\n` +
        'resolves to a live key.'
    )
  }

  // The always-on negative control: a synthetic dead target must be REPORTED.
  // `went_red` is read off what the check actually did, never off what it was
  // expected to do -- the runner turns STAYED GREEN into a cannot-report
  // verdict, so a value derived from the expectation would report a broken
  // gate as healthy.
  const synthetic_dead = [
    {
      id: '__CTRL_DEAD__',
      level: 'param_key',
      records: { probe_dead: 'no_such_live_key' }
    }
  ]
  const controls = [
    {
      name: 'a param_key target that resolves to a dead terminal is reported',
      went_red:
        check_records({ records: synthetic_dead, live: is_live_param })
          .length === 1
    }
  ]
  console.error(format_negative_controls({ controls }))

  // The DECOY is deliberately not in the block above, and that placement is the
  // point. A decoy proves the gate does not OVER-report: a target that resolves
  // live through a legitimate chain (route_ngs -> route -> charted_route) must
  // draw no finding. Its healthy outcome is therefore "did not fire" -- which in
  // the control block's vocabulary prints as STAYED GREEN, the exact token the
  // cluster runner reads as a gate that cannot report. Putting it there would
  // make a correctly-behaving decoy fail the run, so it is asserted separately
  // and folded into the same exit oracle.
  const synthetic_chain_live = [
    {
      id: '__CTRL_CHAIN__',
      level: 'param_key',
      records: { probe_chain: 'pru' }
    }
  ]
  const decoy_findings = check_records({
    records: synthetic_chain_live,
    live: is_live_param
  })
  const decoy_held = decoy_findings.length === 0
  console.error(
    `\nDECOY\n  ${decoy_held ? 'held' : 'FIRED'}  a param_key target that resolves live through a chain draws no finding`
  )

  const control_failures = controls.filter(({ went_red }) => !went_red)
  if (control_failures.length) {
    console.error(
      `\nCONTROL FAILED: ${control_failures.length} control(s) did not behave as expected.`
    )
  }
  if (!decoy_held) {
    console.error(
      `\nDECOY FIRED: the gate reported a legitimate chain as dead (${decoy_findings.join(', ')}).\n` +
        'It is over-reporting, and would go red on correct input.'
    )
  }

  process.exitCode =
    findings.length || control_failures.length || !decoy_held ? 1 : 0
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  main()
}
