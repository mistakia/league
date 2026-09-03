#!/usr/bin/env node

// Print ONE topology value, for the shell.
//
// The deploy path is npm scripts and bash, neither of which can read a JSON
// file. This is the seam that lets them: `$(node scripts/league-topology-value.mjs
// deploy.main_host)` substitutes a value that this PUBLIC repository must not
// contain as a literal.
//
// Deliberately a value printer and not a deploy wrapper. Every deploy script
// keeps its exact shape and only its host literal moves, so the command that
// actually runs is byte-identical to the one that ran before -- the deploy path
// is the most incident-prone surface in this repo and a restructure of it buys
// nothing this needs.
//
// Fails LOUD: an absent file, an unknown section or a missing field exits
// nonzero with the reason on stderr, so `set -e` and npm's `&&` chains stop
// rather than substituting an empty string and running `ssh ''`.
//
//   node scripts/league-topology-value.mjs deploy.main_host
//   node scripts/league-topology-value.mjs backup.host

import { league_topology } from '#libs-server/league-topology.mjs'

const [dotted] = process.argv.slice(2)

if (!dotted || !dotted.includes('.')) {
  process.stderr.write(
    'usage: league-topology-value.mjs <section>.<field> (for example deploy.main_host)\n'
  )
  process.exit(2)
}

const [section, field] = dotted.split('.')

try {
  const values = league_topology(section)
  const value = values[field]
  if (!value) {
    process.stderr.write(
      `league topology section "${section}" has no field "${field}"; it carries ${Object.keys(values).join(', ')}\n`
    )
    process.exit(1)
  }
  // No trailing newline: this is consumed by $(...), which strips one anyway,
  // but a bare value keeps it usable in contexts that do not.
  process.stdout.write(value)
} catch (error) {
  process.stderr.write(`${error.message}\n`)
  process.exit(1)
}
