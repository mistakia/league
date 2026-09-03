import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import os from 'os'

// WHERE THE GENERATION FLEET'S TOPOLOGY LIVES, AND WHY IT IS NOT HERE.
//
// The generation benchmark dispatches to an agent session on another host and
// reads its transcript back out of a tenant container, so it needs a hostname,
// a container name, a path inside that container, and the uid that owns the
// transcript. Every one of those describes THIS fleet and nothing about the
// application, and this repository is PUBLIC -- so none of them may be a
// literal here, not even as an env-overridable default. A default is not a
// weaker form of publishing it; it IS publishing it.
//
// They come instead from a JSON file in the user base, which is private. The
// shape below is generic; the values are not in this repository at all.
//
// WHY NOT SOPS. league encrypts three things -- the production app secrets, the
// external-league credential column key, and the cluster role passwords -- and
// each is a value that grants access on its own. Topology is not that. A
// hostname and a container name grant nothing without the base API credential
// they sit behind; the requirement is that they not be PUBLISHED, which the
// private user base already satisfies. Encrypting them would buy no
// confidentiality worth the cost and would import the fail-closed hazards that
// come with sops: every consuming host would need an age identity in the
// recipient set and a working `sops` on PATH, or the benchmark throws for a
// reason unrelated to anything it is measuring. Not-ours-to-publish and secret
// are different problems and they take different mechanisms.
//
// This mirrors the sandbox postgres credential (config/config-sandbox.json and
// the loader beside it): the value lives outside the repo, the repo commits no
// fallback, and absence fails LOUD and BY NAME rather than degrading into a
// default that happens to work on the author's machine.

const REQUIRED_FIELDS = [
  'host',
  'container',
  'container_user',
  'transcript_dir',
  'metrics_url'
]

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
export const generation_topology_path = () =>
  process.env.LEAGUE_GENERATION_TOPOLOGY_FILE ||
  join(
    resolve_user_base_directory(),
    'config',
    'league-generation-topology.json'
  )

let cached = null

/**
 * Resolve the generation fleet topology, or refuse by name.
 *
 * LAZY, never at module scope. scripts/data-view-benchmark-ground-truth.mjs
 * imports the runner for `check_correctness` alone, which touches no host and
 * no container; a throw at import would break a caller that needs none of
 * this. Only the resolved value is memoized -- a throw is not cached, so a
 * transient read failure costs one call rather than poisoning the process.
 *
 * @returns {{host: string, container: string, container_user: string, transcript_dir: string, metrics_url: string}}
 */
export const generation_topology = () => {
  if (cached) return cached

  const path = generation_topology_path()

  if (!existsSync(path)) {
    throw new Error(
      `generation topology file not found at ${path}. It holds the generation host, tenant container, container user, in-container transcript directory and metrics url. This repository is public, so those values are not committed here and there is no default; set LEAGUE_GENERATION_TOPOLOGY_FILE or place the file in the user base.`
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
      `generation topology file at ${path} is not valid JSON: ${error.message}`
    )
  }

  const missing = REQUIRED_FIELDS.filter((field) => !parsed[field])
  if (missing.length) {
    throw new Error(
      `generation topology file at ${path} is missing ${missing.join(', ')}`
    )
  }

  cached = Object.freeze({
    host: parsed.host,
    container: parsed.container,
    container_user: parsed.container_user,
    transcript_dir: parsed.transcript_dir,
    metrics_url: parsed.metrics_url
  })
  return cached
}

/**
 * Drop the memoized value. For tests that point the loader at successive
 * fixture files; nothing in a run needs it.
 */
export const reset_generation_topology_cache = () => {
  cached = null
}
