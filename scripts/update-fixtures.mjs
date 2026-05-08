#!/usr/bin/env node
/**
 * Refresh external-fantasy-leagues test fixtures end-to-end:
 * 1. Re-collect platform API responses into test/fixtures/external-fantasy-leagues/platform-responses/
 * 2. Regenerate authentic expected outputs in test/fixtures/external-fantasy-leagues/expected-outputs/
 *
 * Wraps the existing per-platform collectors (scripts/collect-{sleeper,espn}-fixtures.mjs)
 * and the expected-output generator (scripts/generate-expected-outputs.mjs). Credentials
 * for platforms that need them are read from secure-config via #config.
 *
 * Usage:
 *   node scripts/update-fixtures.mjs                      # all platforms + regenerate
 *   node scripts/update-fixtures.mjs --platform sleeper   # one platform + regenerate
 *   node scripts/update-fixtures.mjs --platforms sleeper,espn
 *   node scripts/update-fixtures.mjs --skip-collect       # only regenerate expected outputs
 *   node scripts/update-fixtures.mjs --skip-generate      # only collect platform responses
 *   node scripts/update-fixtures.mjs --league-id <id>     # forwarded to collectors
 *   node scripts/update-fixtures.mjs --help
 *
 * See docs/fixture-maintenance.md for the full workflow, including credential setup.
 */

import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

import { is_main } from '#libs-server'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repo_root = path.join(__dirname, '..')

const supported_platforms = ['sleeper', 'espn']

const collector_scripts = {
  sleeper: 'scripts/collect-sleeper-fixtures.mjs',
  espn: 'scripts/collect-espn-fixtures.mjs'
}

function run_node_script(script_path, extra_args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script_path, ...extra_args], {
      cwd: repo_root,
      stdio: 'inherit',
      env: process.env
    })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else
        reject(
          new Error(
            `${path.basename(script_path)} exited with code ${code}`
          )
        )
    })
  })
}

async function collect_platform(platform, forwarded_args) {
  const script = collector_scripts[platform]
  if (!script) {
    throw new Error(`No collector script registered for platform: ${platform}`)
  }
  console.log(`\n=== Collecting fixtures: ${platform} ===`)
  await run_node_script(path.join(repo_root, script), forwarded_args)
}

async function regenerate_expected_outputs() {
  console.log('\n=== Regenerating expected outputs ===')
  await run_node_script(
    path.join(repo_root, 'scripts/generate-expected-outputs.mjs')
  )
}

async function update_fixtures(options) {
  const platforms = options.platforms || supported_platforms

  for (const platform of platforms) {
    if (!supported_platforms.includes(platform)) {
      throw new Error(
        `Unsupported platform: ${platform}. Supported: ${supported_platforms.join(', ')}`
      )
    }
  }

  if (!options.skip_collect) {
    for (const platform of platforms) {
      await collect_platform(platform, options.forwarded_args)
    }
  } else {
    console.log('Skipping platform collection (--skip-collect)')
  }

  if (!options.skip_generate) {
    await regenerate_expected_outputs()
  } else {
    console.log('Skipping expected-output regeneration (--skip-generate)')
  }

  console.log('\nFixture update complete.')
}

function print_help() {
  console.log(`
Usage: node scripts/update-fixtures.mjs [options]

Refreshes external-fantasy-leagues test fixtures by running the per-platform
collector scripts followed by scripts/generate-expected-outputs.mjs.

Options:
  --platform <name>        Update a single platform (sleeper, espn)
  --platforms <a,b,...>    Update a comma-separated list of platforms
  --skip-collect           Skip API collection; only regenerate expected outputs
  --skip-generate          Skip expected-output regeneration; only collect APIs
  --league-id <id>         Forwarded to platform collectors
  --week <n>               Forwarded to platform collectors
  --no-anonymize           Forwarded to platform collectors
  --no-validate            Forwarded to platform collectors
  --season-year <year>     Forwarded to ESPN collector
  --help                   Show this help

Credentials for ESPN (and any future platforms requiring auth) are loaded by
each collector via secure-config. See docs/fixture-maintenance.md.
`)
}

async function main() {
  const argv = process.argv.slice(2)
  const options = {
    platforms: null,
    skip_collect: false,
    skip_generate: false,
    forwarded_args: []
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    switch (arg) {
      case '--platform':
        options.platforms = [argv[++i]]
        break
      case '--platforms':
        options.platforms = argv[++i].split(',').map((s) => s.trim())
        break
      case '--skip-collect':
        options.skip_collect = true
        break
      case '--skip-generate':
        options.skip_generate = true
        break
      case '--league-id':
      case '--week':
      case '--season-year':
        options.forwarded_args.push(arg, argv[++i])
        break
      case '--no-anonymize':
      case '--no-validate':
        options.forwarded_args.push(arg)
        break
      case '--help':
        print_help()
        process.exit(0)
        break
      default:
        console.error(`Unknown argument: ${arg}`)
        print_help()
        process.exit(1)
    }
  }

  await update_fixtures(options)
}

if (is_main(import.meta.url)) {
  main().catch((err) => {
    console.error('update-fixtures failed:', err.message)
    process.exit(1)
  })
}
