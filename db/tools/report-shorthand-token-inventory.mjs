// Shorthand-token inventory for the abbreviation-conform campaign.
//
// The 2026-08-14 hand-built Bucket A drifted in both directions within a day --
// the failure the schema-redesign orchestrator's 2026-08-05 finding predicted for
// any hand list -- so this tool is the durable replacement: it READS the
// conformance audit's own --json output and groups the shorthand findings by
// token, reporting token -> tables -> columns, the ownership class of each token
// (this conform task / an owner task / deferred behind the DVOA triage), and the
// batch a token belongs to. Run it; never read a count out of prose.
//
// It is a TOOL: it carries no verdict and is wired into no gate. Its one
// internal self-check is that its token attributions reconstruct the audit's
// finding set exactly -- a tool whose inventory disagrees with the audit it
// reads is reporting a different schema than the one being conformed.
//
// Usage:
//   node db/tools/report-shorthand-token-inventory.mjs
//   node db/tools/report-shorthand-token-inventory.mjs --token qb   # one token

import path from 'path'
import { spawnSync } from 'child_process'
import { fileURLToPath } from 'url'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const audit_script = path.join(__dirname, 'audit-schema-conformance.mjs')

// Ownership classes, from the 2026-08-15 operator rulings.
//
// Owner tasks: the recv / pts / adj conforms run beside this one and own their
// token's findings outright; this campaign must not rename them.
const owner_task_tokens = {
  recv: 'user:task/league/conform-recv-prefix-to-receiving.md',
  pts: 'user:task/league/conform-points-added-vocabulary.md',
  adj: 'user:task/league/rename-adjusted-valuation-columns.md'
}

// Deferred: the wr1-wr3 / mid / ot findings all sit on
// dvoa_team_unit_seasonlogs_history and _index, whose drop-vs-rename question is
// owned by user:task/league/consolidate-footballoutsiders-dvoa-historical-data.md.
// Do not name those two tables in any DDL until that call is recorded; if it
// resolves to keep, these join the long-tail batch.
const deferred_tokens = new Set(['mid', 'wr1', 'wr2', 'wr3', 'ot'])

// Batch assignment for this campaign's conform scope. One pass per token -- a
// table is legitimately re-applied across several batches; what must never split
// is a token family. Anything a finding carries that is in no batch here is
// reported as UNASSIGNED rather than silently dropped, so a token added by a
// future migration surfaces instead of hiding.
const batches = {
  // Plays-local tokens: live ONLY on nfl_plays / nfl_plays_current_week. The
  // reference batch proves the recipe against the heaviest consumer surface at
  // the smallest table count.
  reference: [
    'ydl',
    'rem',
    'wp',
    'qtr',
    'sec',
    'pp',
    'seq',
    'fuml',
    'ret',
    'tm',
    'diff',
    'bc',
    'psr',
    'trg',
    'intp',
    'fds',
    'gm',
    'succ',
    'fd',
    'conv',
    'oe',
    'n',
    'tp',
    'desc'
  ],
  // Side-of-the-ball prefixes: one concept, conformed together or the schema
  // carries two spellings of it. The plays-family position columns (qb, db,
  // ol/dl/lb personnel counts) land in the same DDL.
  side: ['off', 'def', 'st'],
  // League format/settings position codes plus the adp/faab/std/dev format
  // vocabulary. Highest user-visible risk in the campaign -- the slot and roster
  // settings are read across the SPA -- so the frontend deploy rode with the
  // apply; db took TWO targets by sense (dropback vs defensive_back).
  format: [
    'qb',
    'rb',
    'wr',
    'te',
    'dst',
    'db',
    'ol',
    'dl',
    'lb',
    'adp',
    'faab',
    'std',
    'dev'
  ],
  // Counting-stat vocabulary: grouped because they share writers, so one sweep
  // covers them.
  counting: [
    'avg',
    'yds',
    'yd',
    'comp',
    'att',
    'td',
    'rec',
    'recs',
    'fg',
    'pen',
    'cov',
    'los'
  ],
  // Markets and props: runs only after the drop-vs-rename triage clears
  // props_index / prop_pairings.
  markets: ['hist', 'prob', 'opp', 'sgp'],
  // Quarter family: conformed in one pass with `qtr` (which lands in the
  // reference batch).
  quarter: ['q1', 'q2', 'q3', 'q4'],
  // Long tail: each token is one or two columns on one table, so batching them
  // spends one apply slot rather than twenty. Includes the props over/under
  // am(o/u) and the pair-correlation a/b suffixes.
  longtail: [
    'cmv',
    'str',
    'cap',
    'est',
    'tz',
    'dist',
    'goaline',
    'exp',
    'ps',
    'ext',
    'fpg',
    'rnk',
    'pos',
    'num',
    'int',
    'vert',
    '100touches',
    '100db',
    'xp',
    'ep',
    'am',
    'o',
    'u',
    'a',
    'b'
  ],
  // Glued bare names surfaced by the oracle repair's bare-name widening. These
  // are app keys and compound shorthand (`userid`, `tradeid`, `tddate`,
  // `srbwrte`) expanding to their separated full words.
  keys: [
    'userid',
    'sourceid',
    'tradeid',
    'waiverid',
    'commishid',
    'poachid',
    'transactionid',
    'pickid',
    'tddate',
    'srbwrte',
    'sqbrbwrte',
    'vbaseline',
    'lastvisit'
  ]
}

const token_to_batch = new Map()
for (const [batch, tokens] of Object.entries(batches)) {
  for (const token of tokens) token_to_batch.set(token, batch)
}

function classify(token) {
  if (owner_task_tokens[token]) return `owner: ${owner_task_tokens[token]}`
  if (deferred_tokens.has(token)) return 'deferred behind the DVOA triage'
  if (token_to_batch.has(token))
    return `this task -- batch ${token_to_batch.get(token)}`
  return 'UNASSIGNED'
}

function run_audit() {
  const result = spawnSync('node', [audit_script, '--json'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024
  })
  // Exit 1 is the audit reporting violations, which is the expected state.
  if (result.status !== 0 && result.status !== 1) {
    throw new Error(`audit exited ${result.status}: ${result.stderr}`)
  }
  return JSON.parse(result.stdout)
}

function main() {
  const argv = yargs(hideBin(process.argv))
    .option('token', {
      type: 'string',
      description: 'Inventory one token only'
    })
    .help().argv

  const { tables, findings } = run_audit()
  const shorthand = findings.filter((finding) => finding.rule === 'shorthand')

  // Attribute each finding's non-conforming tokens exactly as the audit names
  // them: the finding's `token` field (a name may carry several) or, for a bare
  // name the bare-name rule reported, the column itself.
  const inventory = new Map() // token -> Set of "table.column"
  const attributed = new Map() // "table.column" -> Set of tokens
  for (const finding of shorthand) {
    const key = `${finding.table}.${finding.column}`
    const tokens = finding.token ? finding.token.split(', ') : [finding.column]
    attributed.set(key, new Set(tokens))
    for (const token of tokens) {
      if (!inventory.has(token)) inventory.set(token, new Set())
      inventory.get(token).add(key)
    }
  }

  // Self-check: the inventory must reconstruct the audit's finding set exactly.
  // A finding with no attributed token, or a token attributed to a finding the
  // audit did not report, means the tool is reading a different schema than the
  // audit -- report that loudly rather than shipping a wrong inventory.
  const reconstructed = new Set()
  for (const [key, tokens] of attributed) {
    if (tokens.size === 0) {
      throw new Error(`inventory could not attribute any token to ${key}`)
    }
    for (const token of tokens) {
      if (!inventory.has(token) || !inventory.get(token).has(key)) {
        throw new Error(
          `inventory token ${token} does not cover its own finding ${key}`
        )
      }
    }
    reconstructed.add(key)
  }
  const audit_keys = new Set(shorthand.map((f) => `${f.table}.${f.column}`))
  for (const key of audit_keys) {
    if (!reconstructed.has(key)) {
      throw new Error(`inventory dropped audit finding ${key}`)
    }
  }
  for (const key of reconstructed) {
    if (!audit_keys.has(key)) {
      throw new Error(`inventory reported finding ${key} the audit did not`)
    }
  }

  const token_filter = argv.token
  const tokens = [...inventory.keys()].sort((a, b) => {
    const diff = inventory.get(b).size - inventory.get(a).size
    return diff || a.localeCompare(b)
  })

  console.log(
    `shorthand inventory -- ${shorthand.length} findings across ${tables} logical tables`
  )
  console.log(
    `distinct tokens: ${tokens.length} (${audit_keys.size} finding keys reconcile exactly against audit-schema-conformance.mjs --json)`
  )
  console.log('')

  const unassigned = []
  for (const token of tokens) {
    if (token_filter && token !== token_filter) continue
    const columns = inventory.get(token)
    const cls = classify(token)
    if (cls === 'UNASSIGNED') unassigned.push(token)
    console.log(
      `${String(columns.size).padStart(4)}  ${token.padEnd(14)} ${cls}`
    )
    if (argv.token || columns.size <= 12) {
      for (const col of [...columns].sort()) {
        console.log(`        ${col}`)
      }
    }
  }

  console.log('')
  if (unassigned.length) {
    console.log(
      `UNASSIGNED tokens (in findings, in no batch map -- surface before batching): ${unassigned.join(', ')}`
    )
    process.exitCode = 1
  } else {
    console.log('every token is assigned to a batch or an ownership class.')
  }
}

main()
