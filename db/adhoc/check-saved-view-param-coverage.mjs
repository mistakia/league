// Orphaned-param oracle for persisted data views. Run at APPLY TIME, against
// PRODUCTION, on any cluster that renames a data-view column param.
//
// WHY THIS EXISTS. `apply_play_by_play_column_params_to_query` iterates the
// nfl-plays param registry and SKIPS any key it does not recognise. So when a
// param is renamed code-side, every saved view still persisting the old key
// silently loses that filter: no error, no log line, no failed test -- just a
// wrong answer. `libs-shared/data-views-saved-view-migration.mjs` is the correct
// remedy (it rewrites persisted params at read time), but nothing tells you a
// rule is MISSING from it. This does.
//
// The 2026-07-24 plays/snaps saved-view migration
// (db/adhoc/2026-07-24-migrate-saved-views-plays-filter-params.sql) covered
// off/def/pos_team and excluded int/to/fuml on the strength of a point-in-time
// production check. A view saved between that check and cutover would have lost
// its filter with nothing to catch it. That is the authoring-time-versus-
// apply-time hole this closes: the check has to run when the rename lands, not
// when the migration is written.
//
// WHAT COUNTS AS RECOGNISED. A persisted param key is recognised when it is
// either declared in one of the shared param registries (common /
// nfl_plays_column_params / nfl_games_params / nfl_plays_team_column_params) or
// named somewhere in the server-side data-view code that consumes params. The
// second test is a PRESENCE grep, and presence-grep is sound here in a way that
// the recipe's absence-greps are not: a false match can only mark a dead key as
// live (under-reporting, caught by the reviewer), and it cannot manufacture a
// spurious orphan. Every reported orphan is then worth reading by hand.
//
// Keys already handled by data-views-saved-view-migration.mjs are recognised
// too -- that layer rewrites them on read, so they are migrated, not orphaned.
//
// Usage (production, read-only, over the `base db` league tunnel -- a working
// `base db query league` means the tunnel is up):
//
//   NODE_ENV=production LEAGUE_DB_HOST=127.0.0.1 LEAGUE_DB_PORT=15432 \
//     node db/adhoc/check-saved-view-param-coverage.mjs
//
//   ... --json                    machine-readable report
//   ... --column-ids              emit the JSON array of column ids persisted in
//                                 saved views, for check-data-view-sql-validity's
//                                 --saved-view-columns reachability tier
//
// Exit 0 = every persisted param key is recognised; 1 = orphaned keys found;
// 2 = tooling error.

import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs/promises'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repo_root = path.join(__dirname, '..', '..')

// Server-side directories whose files are read to decide whether a param key is
// consumed anywhere. Kept narrow on purpose: a key mentioned only in, say, an
// importer has nothing to do with data-view params.
const PARAM_CONSUMER_DIRECTORIES = [
  'libs-server/data-views',
  'libs-server/data-views-column-definitions'
]

const PARAM_CONSUMER_FILES = [
  'libs-server/apply-play-by-play-column-params-to-query.mjs',
  'libs-server/get-data-view-results.mjs',
  'libs-shared/data-views-saved-view-migration.mjs'
]

const walk_directory = async (directory) => {
  const out = []
  const entries = await fs.readdir(directory, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(directory, entry.name)
    if (entry.isDirectory()) out.push(...(await walk_directory(full)))
    else if (entry.name.endsWith('.mjs')) out.push(full)
  }
  return out
}

const build_recognised_key_set = async () => {
  const [common, plays, team] = await Promise.all([
    import('#libs-shared/common-column-params.mjs'),
    import('#libs-shared/nfl-plays-column-params.mjs'),
    import('#libs-shared/nfl-plays-team-column-params.mjs')
  ])

  const declared = new Set([
    ...Object.keys(common),
    ...Object.keys(plays.default),
    ...Object.keys(plays.nfl_games_params),
    ...Object.keys(team.default)
  ])

  const files = [
    ...PARAM_CONSUMER_FILES.map((file) => path.join(repo_root, file))
  ]
  for (const directory of PARAM_CONSUMER_DIRECTORIES) {
    files.push(...(await walk_directory(path.join(repo_root, directory))))
  }

  const consumed = new Set()
  for (const file of files) {
    const text = await fs.readFile(file, 'utf8')
    for (const token of text.match(/[a-z][a-z0-9_]{2,}/g) || []) {
      consumed.add(token)
    }
  }

  return { declared, consumed }
}

// Collects every `params` object reachable in a table_state document, keeping the
// owning column_id so a report can name what actually breaks.
const collect_persisted_params = (table_state) => {
  const found = []
  const walk = (node, column_id) => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) {
      for (const item of node) walk(item, column_id)
      return
    }
    const owner = node.column_id || column_id
    if (
      node.params &&
      typeof node.params === 'object' &&
      !Array.isArray(node.params)
    ) {
      for (const key of Object.keys(node.params)) {
        found.push({ column_id: owner || '(unknown)', key })
      }
    }
    for (const value of Object.values(node)) walk(value, owner)
  }
  walk(table_state, null)
  return found
}

const main = async () => {
  const argv = yargs(hideBin(process.argv))
    .option('json', { type: 'boolean', default: false })
    .option('column-ids', {
      type: 'boolean',
      default: false,
      describe: 'emit persisted column ids as JSON and exit'
    })
    .parse()

  const db = (await import('#db')).default

  try {
    const rows = await db('user_data_views').select('view_id', 'table_state')

    if (argv.columnIds) {
      const column_ids = new Set()
      for (const row of rows) {
        const state =
          typeof row.table_state === 'string'
            ? JSON.parse(row.table_state)
            : row.table_state
        for (const { column_id } of collect_persisted_params(state)) {
          if (column_id !== '(unknown)') column_ids.add(column_id)
        }
        for (const entry of state?.columns || []) {
          if (typeof entry === 'string') column_ids.add(entry)
          else if (entry?.column_id) column_ids.add(entry.column_id)
        }
      }
      console.log(JSON.stringify([...column_ids].sort(), null, 2))
      return
    }

    const { declared, consumed } = await build_recognised_key_set()

    // key -> { count, views:Set, columns:Set }
    const orphans = new Map()
    let total_params = 0

    for (const row of rows) {
      const state =
        typeof row.table_state === 'string'
          ? JSON.parse(row.table_state)
          : row.table_state
      for (const { column_id, key } of collect_persisted_params(state)) {
        total_params++
        if (declared.has(key) || consumed.has(key)) continue
        if (!orphans.has(key)) {
          orphans.set(key, { count: 0, views: new Set(), columns: new Set() })
        }
        const entry = orphans.get(key)
        entry.count++
        entry.views.add(row.view_id)
        entry.columns.add(column_id)
      }
    }

    const findings = [...orphans.entries()]
      .map(([key, entry]) => ({
        param_key: key,
        occurrences: entry.count,
        saved_views: entry.views.size,
        columns: [...entry.columns].sort()
      }))
      .sort((a, b) => b.occurrences - a.occurrences)

    if (argv.json) {
      console.log(
        JSON.stringify(
          { saved_views: rows.length, total_params, findings },
          null,
          2
        )
      )
    } else {
      console.log(
        `\nScanned ${total_params} persisted param key(s) across ${rows.length} saved view(s).`
      )
      for (const finding of findings) {
        console.log(
          `\n  ORPHANED  ${finding.param_key}  ` +
            `(${finding.occurrences} occurrence(s) across ${finding.saved_views} saved view(s))`
        )
        for (const column of finding.columns) console.log(`    on ${column}`)
      }
      if (findings.length) {
        console.log(
          `\nGATE FAIL: ${findings.length} persisted param key(s) are read by nothing.\n` +
            'Each is a filter a user set that the query silently ignores. Add a rename\n' +
            'rule to libs-shared/data-views-saved-view-migration.mjs for every key that\n' +
            'has a current equivalent; a key whose feature is genuinely gone can be\n' +
            'dropped there instead, but decide it explicitly rather than leaving it.'
        )
      } else {
        console.log('\nGATE OK: every persisted param key is recognised.')
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

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  main()
}
