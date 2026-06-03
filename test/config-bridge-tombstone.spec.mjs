/* global describe it before after */
import { expect } from 'chai'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { spawnSync } from 'child_process'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const config_module_path = path.resolve(__dirname, '../config/index.mjs')
const fixture_key_path = path.resolve(__dirname, 'fixtures/test-encryption-key')
const FIXTURE_HEX = fs.readFileSync(fixture_key_path, 'utf8').trim()
const HEX_INLINE = 'b'.repeat(64)

function run_child(script, env_overrides) {
  // Build an env containing only HOME, PATH, and the requested overrides so
  // an inherited CONFIG_ENCRYPTION_KEY_FILE on the developer machine does not
  // leak into the child.
  const env = {
    HOME: process.env.HOME,
    PATH: process.env.PATH,
    NODE_ENV: 'test',
    TZ: 'America/New_York',
    ...env_overrides
  }
  return spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    env,
    encoding: 'utf8'
  })
}

describe('league/config bridge tombstone', () => {
  let tmp_dir

  before(() => {
    tmp_dir = fs.mkdtempSync(path.join(os.tmpdir(), 'league-bridge-test-'))
  })

  after(() => {
    fs.rmSync(tmp_dir, { recursive: true, force: true })
  })

  it('refuses inherited inline CONFIG_ENCRYPTION_KEY when _FILE is unset', () => {
    const script = `import('${config_module_path}').then(() => process.exit(0)).catch((err) => { console.error(err.message); process.exit(1) })`
    const result = run_child(script, { CONFIG_ENCRYPTION_KEY: HEX_INLINE })
    expect(result.status).to.not.equal(0)
    expect(result.stderr).to.match(/CONFIG_ENCRYPTION_KEY_FILE/)
  })

  it('file overrides inherited inline CONFIG_ENCRYPTION_KEY', () => {
    // Use the committed fixture so secure_config can actually decrypt
    // config-test.json. The probe writes the env var value out before any
    // potential downstream import failure.
    const script = `
      const observed = { before: process.env.CONFIG_ENCRYPTION_KEY }
      import('${config_module_path}').then(() => {
        observed.after = process.env.CONFIG_ENCRYPTION_KEY
        process.stdout.write(JSON.stringify(observed))
        process.exit(0)
      }).catch((err) => {
        observed.after = process.env.CONFIG_ENCRYPTION_KEY
        observed.error = err.message
        process.stdout.write(JSON.stringify(observed))
        process.exit(0)
      })
    `
    const result = run_child(script, {
      CONFIG_ENCRYPTION_KEY: HEX_INLINE,
      CONFIG_ENCRYPTION_KEY_FILE: fixture_key_path
    })
    expect(result.status, result.stderr).to.equal(0)
    const observed = JSON.parse(result.stdout)
    expect(observed.before).to.equal(HEX_INLINE)
    expect(observed.after).to.equal(FIXTURE_HEX)
  })

  it('carrier survives post-import access (no lazy re-read in @tsmx/secure-config)', () => {
    const script = `
      import('${config_module_path}').then((mod) => {
        const cfg = mod.default
        delete process.env.CONFIG_ENCRYPTION_KEY
        try {
          // Force property access after env scrub. If the library lazily
          // re-reads process.env at access time this throws; if it cached
          // the key at load time this succeeds.
          JSON.stringify(cfg)
          process.exit(0)
        } catch (err) {
          console.error('lazy-reread:', err.message)
          process.exit(2)
        }
      }).catch((err) => { console.error(err.message); process.exit(1) })
    `
    const result = run_child(script, {
      CONFIG_ENCRYPTION_KEY_FILE: fixture_key_path
    })
    expect(result.status, result.stderr).to.equal(0)
  })
})
