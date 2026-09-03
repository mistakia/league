import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import os from 'os'

// WHERE THIS FLEET'S TOPOLOGY LIVES, AND WHY IT IS NOT HERE.
//
// Several things league does reach OUT of the application and onto named
// infrastructure: the generation benchmark dispatches to an agent session on
// another host and reads its transcript out of a tenant container, and the
// restore tooling pulls dumps off the storage server. Every hostname,
// container name and absolute storage path involved describes THIS fleet and
// nothing about the application -- and this repository is PUBLIC, so none of
// them may be a literal here, not even as an env-overridable default. A
// default is not a weaker form of publishing a value; it IS publishing it.
//
// They come instead from one JSON file in the user base, which is private. The
// section names and field names below are generic; the values are not in this
// repository at all.
//
// WHY NOT SOPS. league encrypts three things -- the production app secrets, the
// external-league credential column key, and the cluster role passwords -- and
// each is a value that grants access on its own. Topology is not that. A
// hostname and a container name grant nothing without the credential they sit
// behind; the requirement is that they not be PUBLISHED, which the private
// user base already satisfies. Encrypting them would buy no confidentiality
// worth the cost and would import the fail-closed hazards that come with sops:
// every consuming host would need an age identity in the recipient set and a
// working `sops` on PATH, or an unrelated command throws. Not-ours-to-publish
// and secret are different problems and they take different mechanisms.
//
// This mirrors the sandbox postgres credential (config/config-sandbox.json and
// the loader beside it): the value lives outside the repo, the repo commits no
// fallback, and absence fails LOUD and BY NAME rather than degrading into a
// default that happens to work on the author's machine.

// Every section this file may be asked for, and the fields each must carry.
// A section is only ever validated when something asks for it, so a host that
// runs restores needs no generation values and the reverse.
const SECTIONS = {
  generation: [
    'host',
    'container',
    'container_user',
    'transcript_dir',
    'metrics_url'
  ],
  backup: ['host', 'dev_fixture_path', 'full_dump_path', 'local_path']
}

/**
 * The user base root, without naming a home directory that belongs to one
 * operator. `USER_BASE_DIRECTORY` is exported fleet-wide; the fallback is the
 * conventional location and carries no username.
 *
 * @returns {string}
 */
export const resolve_user_base_directory = () =>
  process.env.USER_BASE_DIRECTORY || join(os.homedir(), 'user-base')

/**
 * @returns {string} the path the topology is read from
 */
export const league_topology_path = () =>
  process.env.LEAGUE_TOPOLOGY_FILE ||
  join(resolve_user_base_directory(), 'config', 'league-topology.json')

let cached_file = null

const read_topology_file = () => {
  if (cached_file) return cached_file

  const path = league_topology_path()

  if (!existsSync(path)) {
    throw new Error(
      `league topology file not found at ${path}. It holds this fleet's hostnames, container names and storage paths. This repository is public, so those values are not committed here and there is no default; set LEAGUE_TOPOLOGY_FILE or place the file in the user base.`
    )
  }

  let parsed
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    // A malformed file is not a missing one, and must not degrade into
    // "unconfigured" -- that would surface later as an ssh or docker error
    // naming neither this file nor the parse failure.
    throw new Error(
      `league topology file at ${path} is not valid JSON: ${error.message}`
    )
  }

  cached_file = parsed
  return cached_file
}

/**
 * Resolve one section of the fleet topology, or refuse by name.
 *
 * LAZY, never at module scope. scripts/data-view-benchmark-ground-truth.mjs
 * imports the benchmark runner for `check_correctness` alone, which touches no
 * host and no container; a throw at import would break a caller that needs
 * none of this. Only resolved values are memoized -- a throw is not cached, so
 * a transient read failure costs one call rather than poisoning the process.
 *
 * @param {'generation'|'backup'} section
 * @returns {object} the section's fields, frozen
 */
export const league_topology = (section) => {
  const required = SECTIONS[section]
  if (!required) {
    // A typo'd section name must not read as an absent config.
    throw new Error(
      `unknown league topology section "${section}"; known sections are ${Object.keys(SECTIONS).join(', ')}`
    )
  }

  const path = league_topology_path()
  const file = read_topology_file()
  const values = file[section]

  if (!values) {
    throw new Error(
      `league topology file at ${path} has no "${section}" section; it must carry ${required.join(', ')}`
    )
  }

  const missing = required.filter((field) => !values[field])
  if (missing.length) {
    throw new Error(
      `league topology file at ${path} is missing ${section}.${missing.join(`, ${section}.`)}`
    )
  }

  return Object.freeze(
    Object.fromEntries(required.map((field) => [field, values[field]]))
  )
}

/**
 * Drop the memoized file. For tests that point the loader at successive
 * fixtures; nothing in a run needs it.
 */
export const reset_league_topology_cache = () => {
  cached_file = null
}
