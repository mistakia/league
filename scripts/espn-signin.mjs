#!/usr/bin/env node
// Attended ESPN re-auth — the front half of the value-free ESPN session pipeline.
//
// ESPN/Disney gates login behind reCAPTCHA Enterprise + email 2FA, and the
// credential fields live in a cross-origin Disney OneID iframe, so headless
// username/password login no longer works. This driver automates everything a
// machine can and leaves the operator only the irreducible human gates:
//
//   1. reads the account password from the hot KeePassXC vault value-free
//      (base secrets get --stdout: the value is captured over a pipe, never
//      printed, never in argv), programmatic credential extraction;
//   2. launches a headed stealth-browser (visible in the operator's session)
//      and fills the email + password into the Disney iframe value-free;
//   3. waits while the operator solves the reCAPTCHA, clicks Log In, and
//      completes the email 2FA (ticking "remember this device" if offered);
//   4. verifies the espn_s2 session cookie landed and persists the profile.
//
// Run attended, as trashman (whose Aqua session makes the window visible):
//   node scripts/espn-signin.mjs
// then bridge the profile to the sandbox daemon that libs-server/espn-auth.mjs
// reads:
//   ../../cli/browser/migrate-profile-to-daemon.sh espn
//
// The automated back half (fresh espn_s2/SWID extraction) is
// libs-server/espn-auth.mjs. See user:text/base/cloakbrowser-callers.md
// "operator re-auth lifecycle" and user:text/league/espn-auth-pipeline.md.

import os from 'os'
import path from 'path'
import readline from 'readline'
import { spawnSync } from 'child_process'

import {
  launch_persistent_context,
  create_page,
  wait
} from '#private/libs-server/stealth-browser.mjs'
import { ESPN_PROFILE } from '#libs-server/espn-auth.mjs'

// Canonical vault entry (kdbx-hot) for the teflonleague ESPN account password.
const VAULT_ENTRY = 'nfl/espn (teflonleague)'
// Non-secret account identity. Override with --username.
const DEFAULT_USERNAME = 'teflonleague@gmail.com'
const LOGIN_URL = 'https://www.espn.com/login'
const DISNEY_IFRAME = 'iframe[name="disneyid-iframe"]'

const parse_args = () => {
  const args = { username: DEFAULT_USERNAME, profile: ESPN_PROFILE }
  const argv = process.argv.slice(2)
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--username') args.username = argv[++i]
    else if (a === '--profile') args.profile = argv[++i]
    else if (a === '-h' || a === '--help') {
      console.error(
        'usage: node scripts/espn-signin.mjs [--username <email>] [--profile <name>]'
      )
      process.exit(2)
    }
  }
  return args
}

// Read the account password from the hot vault value-free. stderr/stdin are
// inherited so the interactive YubiKey-touch (and cold master) prompts reach the
// operator's tty; only stdout (the value) is captured, and it is never printed.
const read_vault_password = () => {
  const res = spawnSync('base', ['secrets', 'get', VAULT_ENTRY, '--stdout'], {
    encoding: 'utf8',
    stdio: ['inherit', 'pipe', 'inherit']
  })
  if (res.error) {
    throw new Error(`could not run "base secrets get": ${res.error.message}`)
  }
  if (res.status !== 0) {
    throw new Error(
      `vault read failed (exit ${res.status}) — is the hot-kdbx-agent warm and the YubiKey touched?`
    )
  }
  const password = (res.stdout || '').replace(/\n$/, '')
  if (!password) {
    throw new Error('vault returned an empty password (YubiKey timeout?)')
  }
  return password
}

const await_operator = (prompt) =>
  new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin })
    process.stderr.write(prompt)
    rl.once('line', () => {
      rl.close()
      resolve()
    })
  })

const main = async () => {
  const args = parse_args()
  const profile_dir = path.join(
    os.homedir(),
    '.cloakbrowser-profiles',
    args.profile
  )

  // Pull the password first so a vault problem fails before we open a window.
  const password = read_vault_password()

  console.error(
    `[espn-signin] launching headed stealth-browser for profile "${args.profile}"`
  )
  const context = await launch_persistent_context({
    user_data_dir: profile_dir,
    headless: false
  })
  try {
    const page = await create_page(context)
    page.setDefaultNavigationTimeout(120000)
    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' })

    // The Disney OneID form loads inside a cross-origin iframe; frame locators
    // reach it (Playwright is not bound by same-origin policy). Fill value-free.
    const frame = page.frameLocator(DISNEY_IFRAME)
    await frame.locator('input[type="email"]').waitFor({ timeout: 30000 })
    await frame.locator('input[type="email"]').fill(args.username)
    await frame.locator('input[type="password"]').fill(password)

    console.error('')
    console.error(
      '  =========================================================='
    )
    console.error('  Email + password have been filled. In the browser window:')
    console.error('    1. solve the reCAPTCHA challenge')
    console.error('    2. click "Log In"')
    console.error('    3. complete the email 2FA one-time code')
    console.error('       (tick "remember this device" if offered)')
    console.error(
      '  =========================================================='
    )
    await await_operator('\n  When you are fully signed in, press Enter here: ')

    // Verify the session cookie landed.
    await wait(1500)
    const cookies = await context.cookies()
    const has_s2 = cookies.some((c) => c.name === 'espn_s2' && c.value)
    const has_swid = cookies.some((c) => c.name === 'SWID' && c.value)
    if (!has_s2 || !has_swid) {
      throw new Error(
        'espn_s2/SWID not present after sign-in — the login did not complete; re-run'
      )
    }
    console.error('[espn-signin] session verified: espn_s2 + SWID present')
  } finally {
    await context.close()
  }

  console.error('[espn-signin] profile persisted at', profile_dir)
  console.error('')
  console.error(
    'Next: bridge the profile to the sandbox daemon so the headless'
  )
  console.error('consumer (libs-server/espn-auth.mjs) can read the session:')
  console.error('')
  console.error(
    `  ${path.join(process.cwd(), '..', '..', 'cli', 'browser', 'migrate-profile-to-daemon.sh')} ${args.profile}`
  )
  console.error('')
}

main().catch((err) => {
  console.error('[espn-signin] fatal:', err.message)
  process.exit(1)
})
