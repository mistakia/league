// Orphaned-param oracle for data-view SHORT URLS. Run at APPLY TIME, against
// PRODUCTION, on any cluster that renames a top-level `table_state` key.
//
// WHY THIS EXISTS. `check-saved-view-param-coverage.mjs` is the sibling gate for
// persisted views, and it checks the params nested INSIDE a column. This checks
// the top-level query-string keys of the `urls` table, which is a different
// surface with a different remedy and no overlap.
//
// The gap it closes: a URL query string carries NO version field, so it never
// enters the versioned migration chain in `libs-shared/data-view-storage/
// migrations.mjs`. The June 2026 `splits` -> `row_axes` rename did ship a compat
// rule -- but only as `v2_to_v3` on the localStorage snapshot path. Short URLs
// were untouched, so 188 of the 682 production data-view URLs silently rendered
// at the wrong grain for six weeks, and the three that also sorted on the lost
// axis produced unexecutable SQL for real users. Nothing caught it and nothing
// would have: the saved-view gate checks a different surface, and
// `check-data-view-sql-validity.mjs` never exercises `sort` and reported GATE OK
// on the tree where those three URLs failed. Fixed reactively in `924dfe328`.
//
// A short URL is IMMUTABLE once shared -- it cannot be rewritten the way a saved
// view or a localStorage snapshot can -- so the only possible remedy for a key
// this reports is a permanent alias in `LEGACY_URL_PARAM_ALIASES`
// (`app/core/data-views/parse-table-state-from-url.mjs`). There is no migration
// to write and no "drop it instead" option.
//
// WHAT COUNTS AS ACCEPTED. A query-string key is accepted when it is declared in
// `SHARE_LINK_URL_SCHEMA` (either a `table_state` key or a `view` field) or is a
// key of `LEGACY_URL_PARAM_ALIASES`. All three sets are IMPORTED, not grepped.
// That is deliberate and is the one design lesson taken from the saved-view
// gate's own incident: its recognition test was a presence-grep that tokenized
// COMMENTS, so prose naming a legacy key marked that key recognised and the gate
// could not report it at all -- green because it could not see, over the exact
// keys the incident was about. An imported oracle has no such failure mode: a
// deleted alias entry is deleted from the gate's accepted set by construction.
//
// WHICH URLS. Five routes funnel into `parse_table_state_from_url`, and a check
// scoped to `/data-views` alone misses 159 of them -- `/leagues/:lid/players-
// table` is a `<Navigate>` redirect that preserves `location.search`, so its
// query string reaches the same parser (`app/views/routes.js`).
//
// Usage (production, read-only, over the `base db` league tunnel -- a working
// `base db query league` means the tunnel is up):
//
//   NODE_ENV=production LEAGUE_DB_HOST=127.0.0.1 LEAGUE_DB_PORT=15432 \
//     node db/adhoc/check-data-view-url-param-coverage.mjs
//
//   ... --json      machine-readable report
//   ... --verbose   list every accepted key with its URL count
//
// THIS IS NOT A CI GATE, and cannot become one: it reads the production `urls`
// table, so wiring it into CI would make master's health depend on database
// reachability. It is a per-cluster hand-run check, like `check-renamed-column-
// consumers.mjs --gate 2`. Run it when a cluster touches a top-level
// `table_state` key, and again after the frontend deploy that ships the alias.
//
// ACCEPTANCE TEST — this gate must be watched to FAIL before any green from it
// is worth anything, and the falsification is named rather than described:
//
//   1. Delete the `splits: 'row_axes'` entry from LEGACY_URL_PARAM_ALIASES in
//      app/core/data-views/parse-table-state-from-url.mjs.
//   2. NODE_ENV=production LEAGUE_DB_HOST=127.0.0.1 LEAGUE_DB_PORT=15432 \
//        node db/adhoc/check-data-view-url-param-coverage.mjs
//   3. REQUIRED result: `UNACCEPTED  splits` over 423 url(s), exit 1.
//   4. Restore the entry; re-run; exit 0.
//
// Run both directions on 2026-08-05 at `ccc0a3d81`, with a sampled hash
// confirmed to resolve to a real row. Re-run it after any change to this file --
// a gate nobody has watched fail is not evidence, and the sibling saved-view
// gate went un-controlled from the day it was written until the day it was found
// structurally unable to report the keys its own incident was about.
//
// THERE IS NO SUPPRESSION MECHANISM HERE, deliberately. Every accepted key comes
// from an imported declaration, so the only way to quiet a finding is to declare
// the key -- which is the fix. Do not add a name filter or a stoplist: that is
// the third-recorded failure mode in this program of a gate reporting success
// while structurally unable to detect what it measures. If a key ever genuinely
// needs suppressing, do it per key with a recorded reason in a checked-in file.
//
// Exit 0 = every query-string key is accepted by some reader; 1 = unaccepted
// keys found; 2 = tooling error. Sets `process.exitCode` rather than calling
// `process.exit`, which truncates stdout at the 64KB pipe buffer and so silently
// emits unparseable `--json` output.

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { SHARE_LINK_URL_SCHEMA } from 'react-table/src/constants.mjs'
import { LEGACY_URL_PARAM_ALIASES } from '#app/core/data-views/parse-table-state-from-url.mjs'

// Every route whose search string is handed to `parse_table_state_from_url`.
// `/leagues/:lid/players-table` redirects to `/data-views` carrying its own
// query string, so it is the same surface despite the different path.
const DATA_VIEW_PATH_PATTERNS = [
  /^\/data-views(\/[^/]*)?$/,
  /^\/plays(\/[^/]*)?$/,
  /^\/leagues\/[^/]+\/players-table$/
]

const is_data_view_path = (pathname) =>
  DATA_VIEW_PATH_PATTERNS.some((pattern) => pattern.test(pathname))

const build_accepted_key_set = () => {
  const table_state_keys = Object.keys(SHARE_LINK_URL_SCHEMA.table_state)
  const view_keys = [...SHARE_LINK_URL_SCHEMA.view]
  const alias_keys = Object.keys(LEGACY_URL_PARAM_ALIASES)

  return {
    accepted: new Set([...table_state_keys, ...view_keys, ...alias_keys]),
    table_state_keys,
    view_keys,
    alias_keys
  }
}

const main = async () => {
  const argv = yargs(hideBin(process.argv))
    .option('json', { type: 'boolean', default: false })
    .option('verbose', {
      type: 'boolean',
      default: false,
      describe: 'list every accepted key with its URL count'
    })
    .parse()

  const db = (await import('#db')).default

  try {
    const rows = await db('urls').select(
      'url',
      db.raw("convert_from(url_hash, 'UTF8') as url_hash_text")
    )

    const { accepted, table_state_keys, view_keys, alias_keys } =
      build_accepted_key_set()

    // key -> { urls: count, hashes: [] }
    const key_usage = new Map()
    let scanned_urls = 0
    let unparseable_urls = 0

    for (const row of rows) {
      let parsed
      try {
        parsed = new URL(row.url)
      } catch (error) {
        unparseable_urls++
        continue
      }

      if (!is_data_view_path(parsed.pathname)) continue
      scanned_urls++

      // A repeated key is one URL's usage, not two -- count distinct keys.
      for (const key of new Set(parsed.searchParams.keys())) {
        if (!key_usage.has(key)) key_usage.set(key, { urls: 0, hashes: [] })
        const entry = key_usage.get(key)
        entry.urls++
        if (entry.hashes.length < 5 && row.url_hash_text) {
          entry.hashes.push(row.url_hash_text)
        }
      }
    }

    const findings = [...key_usage.entries()]
      .filter(([key]) => !accepted.has(key))
      .map(([key, entry]) => ({
        param_key: key,
        urls: entry.urls,
        sample_short_links: entry.hashes.map((hash) => `/u/${hash}`)
      }))
      .sort((a, b) => b.urls - a.urls)

    const accepted_report = [...key_usage.entries()]
      .filter(([key]) => accepted.has(key))
      .map(([key, entry]) => ({ param_key: key, urls: entry.urls }))
      .sort((a, b) => b.urls - a.urls)

    if (argv.json) {
      console.log(
        JSON.stringify(
          {
            total_urls: rows.length,
            scanned_urls,
            unparseable_urls,
            accepted_keys: {
              table_state: table_state_keys,
              view: view_keys,
              legacy_aliases: alias_keys
            },
            accepted: accepted_report,
            findings
          },
          null,
          2
        )
      )
    } else {
      console.log(
        `\nScanned ${scanned_urls} data-view URL(s) of ${rows.length} row(s) in \`urls\`` +
          (unparseable_urls ? ` (${unparseable_urls} unparseable)` : '') +
          `.\nAccepted keys: ${table_state_keys.length} table_state, ` +
          `${view_keys.length} view, ${alias_keys.length} legacy alias` +
          (alias_keys.length ? ` (${alias_keys.join(', ')})` : '') +
          '.'
      )

      if (argv.verbose) {
        console.log('')
        for (const entry of accepted_report) {
          console.log(
            `  ok        ${entry.param_key.padEnd(24)} ${entry.urls} url(s)`
          )
        }
      }

      for (const finding of findings) {
        console.log(
          `\n  UNACCEPTED  ${finding.param_key}  (${finding.urls} url(s))`
        )
        for (const link of finding.sample_short_links) {
          console.log(`    ${link}`)
        }
      }

      if (findings.length) {
        console.log(
          `\nGATE FAIL: ${findings.length} query-string key(s) are read by no data-view\n` +
            'reader. Each is a shared link that renders at the wrong state silently --\n' +
            'no error, no failed request, just a different answer than the sender saw.\n' +
            'A short URL cannot be rewritten, so the remedy is always a permanent entry\n' +
            'in LEGACY_URL_PARAM_ALIASES (app/core/data-views/parse-table-state-from-url.mjs)\n' +
            'mapping the old key to the key that replaced it. Add a case to\n' +
            'test/data-views.parse-table-state-from-url.spec.mjs in the same change.'
        )
      } else {
        console.log('\nGATE OK: every data-view URL param key is accepted.')
      }
    }

    if (findings.length) process.exitCode = 1
  } catch (error) {
    console.error(`TOOLING ERROR: ${error.message}`)
    console.error(error.stack)
    process.exitCode = 2
  } finally {
    await db.destroy()
  }
}

// Called bare rather than through `is_main`: that helper compares
// `process.argv[1]` VERBATIM against the resolved module path, so a relative
// invocation (which is how anything in db/adhoc is run) silently does nothing
// and exits 0.
main()
