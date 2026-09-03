import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import os from 'os'
import { spawnSync } from 'child_process'

const current_file_path = fileURLToPath(import.meta.url)
const config_dir = dirname(current_file_path)

// sops/age decrypt path for the production config (2026-06-29 envelope-encryption
// cutover). config/config-production.json is sops/age-encrypted at rest, its
// values encrypted to the league domain's recipient set {league, digitalocean-0,
// base-storage} (policy in .sops.yaml). Decryption shells out to the system
// `sops` binary (on PATH on every recipient host via bootstrap
// install-sops-age.sh / brew). Fail-closed by construction: a missing binary, a
// missing/wrong identity, a missing file, or any sops error THROWS — there is no
// path that runs on ciphertext-as-config.
//
// sops's default age-key search path is OS-dependent (macOS uses ~/Library/
// Application Support/sops/age/keys.txt), so export the canonical fleet path
// explicitly. Override via SOPS_AGE_KEY_FILE.
const resolve_age_key_file = () =>
  process.env.SOPS_AGE_KEY_FILE ||
  join(os.homedir(), '.config', 'sops', 'age', 'keys.txt')

// Exported so the external-league credential resolver
// (libs-server/external-fantasy-leagues/utils/credential-encryption.mjs) reuses
// this single fail-closed sops shell-out to read its dedicated {league}-only
// column-key sops file, rather than spawning a second `sops` implementation.
export const load_sops_json = (file_path) => {
  const result = spawnSync(
    'sops',
    ['--decrypt', '--input-type', 'json', '--output-type', 'json', file_path],
    {
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
      env: { ...process.env, SOPS_AGE_KEY_FILE: resolve_age_key_file() }
    }
  )
  if (result.error) {
    if (result.error.code === 'ENOENT') {
      throw new Error(
        'sops binary not found on PATH (install via bootstrap install-sops-age.sh or brew)'
      )
    }
    throw new Error(`sops invocation failed: ${result.error.message}`)
  }
  if (result.status !== 0) {
    const detail = (result.stderr || '').trim() || `exit ${result.status}`
    throw new Error(`sops --decrypt failed for ${file_path}: ${detail}`)
  }
  return JSON.parse(result.stdout)
}

// Dev and test read their config file plaintext off disk. This replaces the
// retired @tsmx/secure-config symmetric-key scheme (2026-07-15 Phase D): those
// hosts were never league age recipients, so there is no encryption tier below
// production worth maintaining a second decrypt path for. config-test.json
// holds only non-sensitive local-fixture values; config-development.json
// leaves any real dev credential blank for the developer to fill in locally
// (never committed).
const load_plaintext_config = () =>
  JSON.parse(
    readFileSync(
      join(config_dir, `config-${process.env.NODE_ENV}.json`),
      'utf8'
    )
  )

// The `sandbox` environment: the data-view generation agent's container.
//
// WHY IT EXISTS AT ALL. `NODE_ENV=production` cannot run there. The production
// branch shells out to `sops` with an age identity and is fail-closed by
// construction, and a tenant container holds neither the binary nor the key --
// so the agent's tool scripts would throw at import. Handing the container that
// key is not the fix: the decrypted production config carries league_writer's
// credentials, which dissolves the league_data_view_reader sandbox role the
// whole boundary rests on. Dev and test read plaintext but leave credentials
// blank, so neither is reusable as is.
//
// WHY A MOUNTED FILE AND NOT ENVIRONMENT VARIABLES. This repository is PUBLIC,
// so a credential committed in config-sandbox.json would be a published
// credential -- the same rule that keeps config-development.json and
// config-test.json to placeholders. The value therefore arrives from outside
// the repo, and it arrives as a FILE for two independent reasons:
//
//   - A thread-config profile CANNOT set an environment variable. The posture
//     allowlist (THREAD_CONFIG_FIELDS in the base repo) carries no env field
//     and the loader refuses a profile naming one, so an earlier version of
//     this comment describing "the profile's secret mechanism as environment
//     variables" described a mechanism that does not exist. What a profile CAN
//     do is mount a host path read-only, which is how this file arrives.
//   - An environment value is visible in `docker inspect` and in
//     /proc/<pid>/environ. Base makes exactly this choice for its own tenant
//     credentials: the file is mounted read-only and what goes into the
//     environment is its PATH, never the value.
//
// The path is a constant rather than a variable for the first reason above --
// nothing can set a variable in this container. LEAGUE_SANDBOX_CREDENTIAL_FILE
// overrides it so a test can point at a temporary file; the container uses the
// default.
//
// Applies ONLY under NODE_ENV=sandbox: reading this file in any other
// environment would let a stray mount silently re-point a production or test
// process at a different database.
export const SANDBOX_CREDENTIAL_CONTAINER_PATH =
  '/run/secrets/league-sandbox-postgres.json'

const sandbox_credential_path = () =>
  process.env.LEAGUE_SANDBOX_CREDENTIAL_FILE ||
  SANDBOX_CREDENTIAL_CONTAINER_PATH

// Read is tolerant; the REQUIREMENT is enforced lazily by
// assert_sandbox_credentials at the connection sites. A missing file here is
// not an error, because four of the six agent tools never open a connection.
const read_sandbox_credential = () => {
  const path = sandbox_credential_path()
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    // A malformed credential file is NOT a missing one, and must not degrade
    // into "no credential" -- that would surface as an authentication failure
    // naming neither this file nor the parse error.
    throw new Error(
      `sandbox credential file at ${path} is not valid JSON: ${error.message}`
    )
  }
}

const overlay_sandbox_environment = (loaded) => {
  const credential = read_sandbox_credential()
  if (!credential) return loaded

  for (const key of ['postgres', 'postgres_data_view_sandbox']) {
    if (credential.host) loaded[key].connection.host = credential.host
    if (credential.password) {
      loaded[key].connection.password = credential.password
    }
    if (credential.port) loaded[key].connection.port = Number(credential.port)
  }

  return loaded
}

/**
 * Refuse, by name, to open a sandbox database connection without a credential.
 *
 * Called from the places that actually build a pool or run a query, never at
 * import. The requirement is lazy because four of the six agent tools --
 * search_columns, describe_column, validate_table_state and emit -- are
 * registry and schema operations that never reach Postgres; requiring it at
 * import killed all six under a message about Postgres. db/sandbox-pool.mjs
 * states the same rule: fail when a query is actually run, naming what is
 * missing.
 *
 * Fail LOUD and by name. A blank password reaches Postgres as an authentication
 * failure whose message names neither this config nor the credential file, and
 * the debugger goes looking at pg_hba or at the role grants instead.
 *
 * A no-op outside NODE_ENV=sandbox, so ordinary environments are untouched.
 */
export const assert_sandbox_credentials = () => {
  if (process.env.NODE_ENV !== 'sandbox') return

  const path = sandbox_credential_path()
  const credential = read_sandbox_credential()

  if (!credential) {
    throw new Error(
      `NODE_ENV=sandbox needs the postgres credential file at ${path} to open a database connection; it is not mounted. The sandbox config is committed credential-free because this repository is public.`
    )
  }

  const missing = ['host', 'password']
    .filter((field) => !credential[field])
    .join(' and ')

  if (missing) {
    throw new Error(
      `the sandbox credential file at ${path} is missing ${missing}`
    )
  }
}

// Production is the only environment on the sops/age scheme; dev, test and
// sandbox stay plaintext.
const load_config = () => {
  if (process.env.NODE_ENV === 'production') {
    return load_sops_json(join(config_dir, 'config-production.json'))
  }
  if (process.env.NODE_ENV === 'sandbox') {
    return overlay_sandbox_environment(load_plaintext_config())
  }
  return load_plaintext_config()
}

const config = load_config()

export default config
