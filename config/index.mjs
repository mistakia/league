import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import os from 'os'
import { spawnSync } from 'child_process'

const current_file_path = fileURLToPath(import.meta.url)
const config_dir = dirname(current_file_path)

// sops/age decrypt path for the production config (2026-06-29 envelope-encryption
// cutover). config/config-production.json is sops/age-encrypted at rest, its
// values encrypted to the league domain's recipient set {league, league-worker-1,
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

// Production is the only environment on the sops/age scheme; dev and test
// stay plaintext.
const config =
  process.env.NODE_ENV === 'production'
    ? load_sops_json(join(config_dir, 'config-production.json'))
    : load_plaintext_config()

export default config
