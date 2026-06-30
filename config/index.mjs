import { readFileSync } from 'fs'
import secure_config from '@tsmx/secure-config'
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

const load_sops_json = (file_path) => {
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

// Legacy @tsmx/secure-config path, retained for the development and test
// environments only. Those run on hosts that are NOT league age recipients
// (local dev / CI), so they keep decrypting config-<NODE_ENV>.json with the
// symmetric key. CONFIG_ENCRYPTION_KEY_FILE is required and dereferenced into
// process.env.CONFIG_ENCRYPTION_KEY (a process-internal carrier @tsmx reads);
// any inherited inline CONFIG_ENCRYPTION_KEY is overwritten and never trusted.
// config-test.json is decrypted with the committed in-repo test fixture key.
const load_secure_config = () => {
  if (!process.env.CONFIG_ENCRYPTION_KEY_FILE) {
    throw new Error('CONFIG_ENCRYPTION_KEY_FILE must be set')
  }
  try {
    process.env.CONFIG_ENCRYPTION_KEY = readFileSync(
      process.env.CONFIG_ENCRYPTION_KEY_FILE,
      'utf8'
    ).trim()
  } catch (err) {
    throw new Error(
      `CONFIG_ENCRYPTION_KEY_FILE unreadable: ${process.env.CONFIG_ENCRYPTION_KEY_FILE}: ${err.code || err.message}`
    )
  }
  return secure_config({ directory: config_dir })
}

// Production is the only environment migrated to sops/age; dev and test stay on
// the legacy symmetric scheme (their consumers are not age recipients).
const config =
  process.env.NODE_ENV === 'production'
    ? load_sops_json(join(config_dir, 'config-production.json'))
    : load_secure_config()

export default config
