/* global describe it beforeEach */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import * as chai from 'chai'

import {
  BUILD_MANIFEST_URL,
  DISMISSED_BUILD_STORAGE_KEY,
  RECHECK_DELAYS_MS,
  dismiss_build,
  fetch_deployed_build,
  get_running_build,
  is_newer_build,
  note_running_build,
  read_dismissed_build,
  reset_stale_build_state,
  should_invite_reload
} from '@core/stale-build'

const expect = chai.expect
const repo_root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

// A TAB WHOSE RECONNECT WORKS PERFECTLY NEVER LEARNS IT IS STALE.
//
// A deploy is a pm2 reload, which drops every socket; the client reconnects on
// its own about four seconds later and keeps running the JavaScript it loaded
// hours ago. Two deploys passed a manager's tab during the live League 1
// auction on 2026-09-03 and he never received the fix that had shipped for him.
//
// The bundle carries no sha and must not be given one, so the comparison is
// against a BASELINE: the manifest read once at boot is the build this tab
// started on. Everything below drives that comparison, plus the two ways it
// silently never fires -- a cached re-read, and a check timed before the new
// bundle exists.

const build = (sha, built_at) => ({ sha, built_at })

const fake_storage = ({ throws = false } = {}) => {
  const values = new Map()
  return {
    getItem: (key) => {
      if (throws) throw new Error('storage disabled')
      return values.has(key) ? values.get(key) : null
    },
    setItem: (key, value) => {
      if (throws) throw new Error('storage disabled')
      values.set(key, value)
    },
    values
  }
}

describe('stale build notice', function () {
  beforeEach(function () {
    reset_stale_build_state()
  })

  describe('reading the deployed manifest', function () {
    // THE FAILURE THIS WHOLE GROUP EXISTS FOR IS SILENT. `/dist` is served
    // `Cache-Control: public, max-age=31536000, immutable` for every file under
    // it, and build-manifest.json is the one member of that directory that
    // changes under a stable URL. Measured against production on 2026-09-04: a
    // repeated default fetch reports `transferSize: 0` and never touches the
    // network, so the re-read returns the boot value for the life of the tab
    // and the nudge can never fire.
    const capture_fetch = (payloads) => {
      const calls = []
      let index = 0
      const fetch_impl = async (url, init) => {
        calls.push({ url, init })
        const payload = payloads[Math.min(index, payloads.length - 1)]
        index += 1
        if (payload === null) throw new Error('network down')
        return {
          ok: payload.ok !== false,
          json: async () => payload
        }
      }
      return { fetch_impl, calls }
    }

    it('asks the network every time, bypassing the HTTP cache', async function () {
      const { fetch_impl, calls } = capture_fetch([
        build('aaa', '2026-09-03T23:00:00.000Z')
      ])

      await fetch_deployed_build({ fetch_impl })

      // The proven control. Without this the browser answers from its own cache
      // and the feature is a no-op that looks like it is working.
      expect(calls[0].init.cache).to.equal('no-store')
    })

    it('makes the URL novel, so no edge cache can answer it', async function () {
      const { fetch_impl, calls } = capture_fetch([
        build('aaa', '2026-09-03T23:00:00.000Z')
      ])

      await fetch_deployed_build({ fetch_impl, now: () => 1234 })

      // Cloudflare answers this path `cf-cache-status: DYNAMIC` today, so the
      // edge is not the problem yet. A cache rule over `/dist/*` would make it
      // one, and only a URL the edge has never seen is immune.
      expect(calls[0].url).to.equal(`${BUILD_MANIFEST_URL}?t=1234`)
      expect(calls[0].url).to.not.equal(BUILD_MANIFEST_URL)
    })

    it('sets no request header, which would make the browser preflight', async function () {
      const { fetch_impl, calls } = capture_fetch([
        build('aaa', '2026-09-03T23:00:00.000Z')
      ])

      await fetch_deployed_build({ fetch_impl })

      // `Cache-Control` as a REQUEST header is outside the CORS-simple set and
      // is not named in Access-Control-Allow-Headers, so reaching for it
      // instead of `cache: 'no-store'` breaks this fetch outright in dev (which
      // is cross-origin) while working in production (which is not).
      expect(calls[0].init.headers).to.equal(undefined)
    })

    it('returns the CHANGED value on a second read', async function () {
      // The claim the feature rests on, asserted rather than assumed: a re-read
      // observes a deploy. A memo like `read_build`'s `cached_build` would
      // return the first value forever and pass every other test here.
      const { fetch_impl } = capture_fetch([
        build('aaa', '2026-09-03T23:02:49.000Z'),
        build('bbb', '2026-09-03T23:33:28.000Z')
      ])

      const first = await fetch_deployed_build({ fetch_impl })
      const second = await fetch_deployed_build({ fetch_impl })

      expect(first.sha).to.equal('aaa')
      expect(second.sha).to.equal('bbb')
    })

    it('degrades to null on a refusal', async function () {
      const { fetch_impl } = capture_fetch([{ ok: false }])

      expect(await fetch_deployed_build({ fetch_impl })).to.equal(null)
    })

    it('degrades to null on a throw rather than propagating it', async function () {
      const { fetch_impl } = capture_fetch([null])

      expect(await fetch_deployed_build({ fetch_impl })).to.equal(null)
    })
  })

  describe('the baseline', function () {
    it('is the first usable read and nothing moves it afterwards', function () {
      // The baseline is a statement about the JavaScript already executing in
      // this tab. If a later read could overwrite it, the first check after a
      // deploy would adopt the NEW build as "what I am running" and the tab
      // would go quiet forever -- the exact defect, reintroduced.
      note_running_build(build('aaa', '2026-09-03T23:02:49.000Z'))
      note_running_build(build('bbb', '2026-09-03T23:33:28.000Z'))

      expect(get_running_build().sha).to.equal('aaa')
    })

    it('is not established by a failed or sha-less read', function () {
      // A boot read that fails must leave the feature dormant, not disabled: a
      // later reconnect or tab focus still gets to set the baseline.
      note_running_build(null)
      note_running_build(build(null, '2026-09-03T23:02:49.000Z'))
      expect(get_running_build()).to.equal(null)

      note_running_build(build('aaa', '2026-09-03T23:02:49.000Z'))
      expect(get_running_build().sha).to.equal('aaa')
    })
  })

  describe('the comparison', function () {
    it('says nothing before a baseline exists', function () {
      expect(
        is_newer_build(null, build('bbb', '2026-09-03T23:33:28.000Z'))
      ).to.equal(false)
    })

    it('is quiet when the deployed build is the running one', function () {
      expect(
        is_newer_build(
          build('aaa', '2026-09-03T23:02:49.000Z'),
          build('aaa', '2026-09-03T23:02:49.000Z')
        )
      ).to.equal(false)
    })

    it('is quiet when the SAME commit was rebuilt later', function () {
      // Same sha, later built_at. Not hypothetical and not rare: `deploy:all`
      // runs `yarn build` unconditionally, so re-running a deploy that partly
      // failed -- the recurring incident in docs/guides/ship.md -- rebuilds the
      // identical commit and stamps a new built_at. Nudging on that asks every
      // manager in a live auction to reload for byte-identical JavaScript.
      //
      // Written with DIFFERING timestamps on purpose: with them equal, the
      // monotonicity guard returns false on its own and this assertion passes
      // whether or not the sha check exists at all.
      expect(
        is_newer_build(
          build('aaa', '2026-09-03T23:02:49.000Z'),
          build('aaa', '2026-09-03T23:33:28.000Z')
        )
      ).to.equal(false)
    })

    it('fires on the real case: a different sha, built later', function () {
      // The two deploys that passed the manager's tab, by their real timestamps.
      expect(
        is_newer_build(
          build('c2cd9f013', '2026-09-03T23:02:49.000Z'),
          build('7c6837e48', '2026-09-03T23:33:28.000Z')
        )
      ).to.equal(true)
    })

    it('refuses to point BACKWARDS, which is what stops a nudge loop', function () {
      // If any layer ever answers with an older manifest, sha inequality alone
      // would invite a reload into the build the tab is already running -- and
      // the read after that reload would invite it again, forever, during a
      // live auction. `built_at` is what makes this monotone.
      expect(
        is_newer_build(
          build('7c6837e48', '2026-09-03T23:33:28.000Z'),
          build('c2cd9f013', '2026-09-03T23:02:49.000Z')
        )
      ).to.equal(false)
    })

    it('falls back to sha inequality when a timestamp is unusable', function () {
      // Deliberately permissive. Refusing here would be the silent
      // never-fires failure this module is written to avoid, and it is the
      // direction that looks like success.
      expect(is_newer_build(build('aaa', null), build('bbb', null))).to.equal(
        true
      )
      expect(
        is_newer_build(build('aaa', 'not a date'), build('bbb', 'nor this'))
      ).to.equal(true)
    })
  })

  describe('dismissal', function () {
    it('silences the build that was dismissed', function () {
      const running = build('aaa', '2026-09-03T23:02:49.000Z')
      const deployed = build('bbb', '2026-09-03T23:33:28.000Z')

      expect(
        should_invite_reload({ running, deployed, dismissed_sha: null })
      ).to.equal(true)
      expect(
        should_invite_reload({ running, deployed, dismissed_sha: 'bbb' })
      ).to.equal(false)
    })

    it('does NOT silence the next build', function () {
      // THE CONTROL for the assertion above. A boolean "dismissed" flag would
      // satisfy it and then swallow every future deploy for the life of the
      // browser profile, which is the same silence this feature exists to end.
      const running = build('aaa', '2026-09-03T23:02:49.000Z')
      const next = build('ccc', '2026-09-04T01:00:00.000Z')

      expect(
        should_invite_reload({ running, deployed: next, dismissed_sha: 'bbb' })
      ).to.equal(true)
    })

    it('round-trips through storage under one key', function () {
      const storage = fake_storage()

      expect(read_dismissed_build(storage)).to.equal(null)
      expect(dismiss_build('bbb', storage)).to.equal(true)
      expect(read_dismissed_build(storage)).to.equal('bbb')
      expect(storage.values.get(DISMISSED_BUILD_STORAGE_KEY)).to.equal('bbb')
    })

    it('survives storage that throws on access', function () {
      // Some privacy settings throw on localStorage rather than returning null.
      const storage = fake_storage({ throws: true })

      expect(read_dismissed_build(storage)).to.equal(null)
      expect(dismiss_build('bbb', storage)).to.equal(false)
    })
  })

  describe('when a reconnect is re-checked', function () {
    it('spans the window between the pm2 reload and the new bundle', function () {
      // THE TIMING TRAP, as an assertion. `deploy:all` is
      // `yarn deploy && yarn build && yarn deploy:dist`, and `deploy` ENDS in
      // pm2 reload -- so the socket drop that signals a deploy arrives a whole
      // webpack production build BEFORE the manifest is rsynced. The two
      // deploys on 2026-09-03 reconnected 85s and 27s before their bundles
      // landed. A single immediate check reads the OLD manifest and concludes
      // the tab is current, which is the original defect wearing a fix.
      expect(RECHECK_DELAYS_MS[0]).to.equal(0)
      expect(Math.max(...RECHECK_DELAYS_MS)).to.be.at.least(120000)
      expect(
        RECHECK_DELAYS_MS.filter((delay) => delay >= 27000 && delay <= 300000)
      ).to.have.length.above(1)
    })

    it('is bounded, so no tab polls origin forever', function () {
      expect(RECHECK_DELAYS_MS).to.be.an('array')
      expect(RECHECK_DELAYS_MS.length).to.be.below(8)
      expect(Object.isFrozen(RECHECK_DELAYS_MS)).to.equal(true)
    })
  })

  // Source gates. The component cannot be driven from a spec -- it is React
  // with no jsdom, and `connect` reaches `@core/store`, which reads
  // `window.__INITIAL_STATE__` at module scope. So the LOGIC is unit-tested
  // above and the WIRING is held by reading it, the same split as
  // test/websocket.send-queue.spec.mjs.
  describe('the wiring', function () {
    const read = (relative) =>
      fs.readFileSync(path.join(repo_root, relative), 'utf8')

    const notice =
      'app/views/components/stale-build-notice/stale-build-notice.js'

    it('is mounted on every route, not inside the league routes', function () {
      // A stale bundle is not a league-scoped condition, and the anonymous
      // /data-views and /plays pages run the same one.
      const app = read('app/views/components/app/app.js')

      expect(app).to.include("from '@components/stale-build-notice'")
      expect(app).to.include('<StaleBuildNotice />')
    })

    it('NEVER auto-reloads: the only reload is a click handler', function () {
      // The hardest requirement in the brief. Managers are bidding real money
      // against a clock; a page that reloads itself mid-bid is worse than a
      // stale bundle.
      const source = read(notice)
      const occurrences = source.split('location.reload').length - 1

      // The positive first, so the structural assertion below cannot pass
      // against a file that has no reload in it at all.
      expect(occurrences).to.equal(1)

      const reload_at = source.indexOf('location.reload')
      const handler_at = source.indexOf('const on_reload = useCallback')
      expect(handler_at, 'the reload still lives in on_reload').to.be.above(-1)
      expect(reload_at).to.be.above(handler_at)
      expect(source).to.include('onClick={on_reload}')
    })

    it('is the only new reload call site in the tree', function () {
      // Enumerated from the tree rather than from the names this session
      // happened to look at. A future auto-reload added anywhere in app/ fails
      // here whatever it is called.
      const files = []
      const walk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name)
          if (entry.isDirectory()) walk(full)
          else if (entry.name.endsWith('.js')) files.push(full)
        }
      }
      walk(path.join(repo_root, 'app'))

      const reloaders = files
        .filter((file) =>
          fs.readFileSync(file, 'utf8').includes('location.reload')
        )
        .map((file) => path.relative(repo_root, file))
        .sort()

      expect(reloaders).to.deep.equal([
        // The chunk-load recovery. Pre-existing, guarded by a one-shot
        // sessionStorage window, and about a bundle that cannot load at all.
        'app/core/bugsnag.js',
        // The error boundary's own "try again" button.
        'app/views/components/error-view/error-view.js',
        notice
      ])
    })

    it('polls nothing: the schedule is anchored to a reconnect', function () {
      const source = read(notice)

      expect(source).to.include('RECHECK_DELAYS_MS')
      expect(source).to.include('setTimeout')
      // A bare interval is what this design rejects -- it asks origin forever,
      // on every open tab, a question that only changes when a deploy happens.
      expect(source).to.not.include('setInterval')
    })

    it('watches the socket transition rather than a timer', function () {
      const source = read(notice)

      expect(source).to.include('was_connected')
      expect(source).to.include('visibilitychange')
    })

    it('takes its z-index from the scale, between chrome and the dialogs', function () {
      const styles = read(
        'app/views/components/stale-build-notice/stale-build-notice.styl'
      )
      expect(styles).to.include('z-index $z_stale_build_notice')

      const scale = read('app/styles/variables.styl')
      const value_of = (name) => {
        const match = scale.match(new RegExp(`\\${name} = (\\d+)`))
        expect(match, `${name} is still on the scale`).to.not.equal(null)
        return Number(match[1])
      }

      // The ordering IS the design: above sticky table headers so it is not
      // buried, below every dialog, popper and drawer so it can never cover a
      // control a manager is trying to use.
      expect(value_of('$z_stale_build_notice')).to.be.above(
        value_of('$z_page_chrome')
      )
      expect(value_of('$z_stale_build_notice')).to.be.below(
        value_of('$z_floating_action_backdrop')
      )
      expect(value_of('$z_stale_build_notice')).to.be.below(
        value_of('$z_dialog')
      )
    })

    it('leaves the contribution capture memo alone', function () {
      // `cached_build`'s contract is load-bearing: `undefined` means not
      // fetched, `null` means fetched and failed, and the two stay
      // distinguishable so a failed fetch is not retried on every capture. The
      // poller must not reach into it, and capture must not start re-fetching.
      // Anchored on the syntactic role, not the token: this module's header
      // NAMES both `contribution-context` and `read_build` in prose, to say why
      // it does not use them, so a bare substring check fires on the
      // explanation rather than on a defect.
      const core = read('app/core/stale-build.js')
      const core_imports = core
        .split('\n')
        .filter((line) => line.startsWith('import '))
      expect(core_imports.join('\n')).to.not.include('contribution-context')
      expect(core).to.not.include('read_build(')

      // And the contract itself, unchanged: `undefined` is not fetched, `null`
      // is fetched and failed, and nothing new reaches into the memo.
      const context = read('app/core/contribution-context.js')
      expect(context).to.include('let cached_build')
      expect(context).to.include(
        'if (cached_build !== undefined) return cached_build'
      )
      const context_imports = context
        .split('\n')
        .filter((line) => line.startsWith('import '))
      expect(context_imports.join('\n')).to.not.include('stale-build')
    })
  })
})
