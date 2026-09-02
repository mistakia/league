import { readFileSync } from 'fs'
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
// WHY THE CREDENTIALS ARE BLANK IN THE FILE AND OVERLAID FROM THE ENVIRONMENT.
// This repository is PUBLIC and every file in it is published, so a plaintext
// credential committed in config-sandbox.json would be a published credential --
// the same rule that keeps config-development.json and config-test.json to
// placeholders. The plan this implements called for a plaintext config carrying
// the reader credential; that is not available here, and an env overlay is the
// nearest shape that keeps the property the plan actually wanted: the container
// never holds the age identity or any write-capable credential.
//
// The values arrive through the thread-config profile's secret mechanism as
// environment variables, never as a literal in a command -- tool calls are
// recorded verbatim in a synced, indexed timeline.
//
// It applies ONLY under NODE_ENV=sandbox. Reading these variables in any other
// environment would let an ambient variable silently re-point a production or
// test process at a different database.
const overlay_sandbox_environment = (loaded) => {
  const host = process.env.LEAGUE_SANDBOX_PG_HOST
  const password = process.env.LEAGUE_SANDBOX_PG_PASSWORD
  const port = process.env.LEAGUE_SANDBOX_PG_PORT

  // Fail LOUD and by name. A blank password reaches Postgres as an
  // authentication failure whose message names neither this file nor the
  // missing variable, and the debugger goes looking at pg_hba or the role.
  if (!host || !password) {
    throw new Error(
      'NODE_ENV=sandbox requires LEAGUE_SANDBOX_PG_HOST and LEAGUE_SANDBOX_PG_PASSWORD; the sandbox config is committed credential-free because this repository is public'
    )
  }

  for (const key of ['postgres', 'postgres_data_view_sandbox']) {
    loaded[key].connection.host = host
    loaded[key].connection.password = password
    if (port) loaded[key].connection.port = Number(port)
  }

  return loaded
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
