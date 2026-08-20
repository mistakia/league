// League-schema consumer gate.
//
// WHAT THIS FILE IS. Every statement in the corpus that is bound to the LEAGUE
// database, from any transport, inside or outside this checkout, checked against
// `db/schema.postgres.sql`. Three extractions -- prose pairs, fenced SQL, and
// executable SQL out of shell scripts and `/api/db/league/query` calls -- feeding
// one oracle, one adjudication file and one scratch database.
//
// A STATEMENT IS BOUND TO THE DATABASE ITS TRANSPORT NAMES, NOT TO THE FILE THAT
// HOLDS IT. This is the load-bearing rule and it is the reason the gate can reach
// executable surfaces at all. Both transports state their database in text this
// gate already reads: a shell script names it in the `psql -d <target>` that runs
// the SQL, and an API caller names it in the `/api/db/<database>/query` path. So
// the corpus can hold `check-nano-archive-fresh.sh` beside
// `check-league-lineage-consistency.sh` and judge only the second against the
// league schema, without either file's NAME entering the derivation.
//
// **THIS IS NOT A NAME FILTER, AND THE DISTINCTION IS THE WHOLE POINT.** A
// name/stoplist filter is how a real defect got hidden: `check-renamed-column-
// consumers` carried a list of common column names and returned 129 findings with
// not one of them `total`, over a rename that wiped a year of projection values.
// The derivation here never reads the filename. That `check-league-*.sh` and
// `league_production` happen to agree is a coincidence the resolver cannot see,
// and it is exactly what lets the same rule separate `check-nano-archive-fresh.sh`
// correctly. What it reads is the transport's own statement of its target.
//
// The two ways that resolution can decline are PRINTED BUCKETS, never a silent
// pass and never a silent skip:
//
//   DATABASE-SCOPED  the transport names a database that is not league, so this
//                    gate's schema is the wrong oracle for it. Counted, listed,
//                    and not EXPLAINed. `check-nano-*` and the two finance
//                    scripts live here.
//   UNRESOLVED       the transport names a target this resolver cannot reduce to
//                    a literal (`psql -d $database`, where the target is a loop
//                    variable). Counted, listed, and not EXPLAINed.
//
// Both exist because of entry 028's rule: a gate that cannot classify a statement
// and a gate that checked it and found nothing wrong are indistinguishable in a
// summary line, and only one of them is coverage. Read those two buckets as
// adversarially as the findings.
//
// WHY THE DOCUMENTATION HALF EXISTS. Documentation is a schema consumer that no
// other gate reads.
// The mocha suite, the data-view goldens, `check-data-view-sql-validity`, the
// conformance ratchet and `check-api-response-shapes` all pass straight over
// prose, so a rename cluster that conforms a column and forgets its docs leaves
// drift that compounds cluster over cluster and is never flagged. On 2026-08-05
// that corpus was repaired by hand (league `494ba8e25`, user-base `2f2539742`)
// with throwaway scripts that were deleted. This makes the repair a ratchet.
//
// The corpus is not decoration. `guideline/nfl/`, `text/league/` and
// `workflow/nfl/` in user-base carry runnable SQL that agent sessions read as
// canonical instruction, and a 2026-07-29 sweep found ~20 stale files there
// tracing to at least four rename clusters, none of which had ever swept them.
//
//   GATE 1  qualified pairs -- every `table.column` token in the corpus whose
//           table is a real table must name a real column of that table. Static,
//           needs no database. Judged per (table, column), NEVER per column name:
//           `nfl_plays.psr_gsis`/`trg_gsis` survive while `psr_pid`/`trg_pid`
//           became `passer_pid`/`target_pid` -- same conform, same table,
//           opposite outcomes -- and a global rename would have damaged four of
//           five such cases in a 2026-07-30 sweep. It also reads every documented
//           `CREATE INDEX ... ON <table> (<columns>)`, which states the same
//           claim in the one form the pair regex cannot see -- the columns are
//           unqualified -- and which gate 2 cannot reach either, DDL being
//           un-EXPLAINable. That is the whole content of the index-naming
//           reference, which had no oracle at all until 2026-08-05.
//
//   GATE 2  executable SQL -- every fenced ```sql block is split into statements,
//           template placeholders are substituted, and each statement is
//           EXPLAINed against a throwaway database loaded from
//           `db/schema.postgres.sql`. This resolves UNQUALIFIED column references,
//           which gate 1 structurally cannot see. It is not redundant: on the
//           manual sweep it caught seven sites the regex missed, including
//           `FROM projections` (the table is `projections_history`) and a join on
//           a `prop_market_selections_index.esbid` that table has never had.
//
//   GATE 3  executable SQL -- SQL lifted out of a bash assignment, a heredoc, an
//           inline `psql -c`, or the `sql` argument of an `/api/db/<database>/
//           query` call, bound to its transport's database and EXPLAINed against
//           the same throwaway database as gate 2. Gate 1 cannot see these (they
//           write unqualified references and short aliases like `rp.year`) and
//           gate 2 cannot either (a bash variable is not a fence). EXPLAIN is the
//           only oracle that resolves both shapes, and gate 2 already owns it.
//
//   GATE 4  executable SQL -- a standalone `.sql` FILE, bound to the league
//           database by the `--root` it arrived under, placeholders substituted,
//           and EXPLAINed against the same throwaway database as gates 2 and 3.
//           None of the three derivations above can see one: it has no prose to
//           read, no ```sql fence, and no transport naming a database. Measured
//           2026-08-15, `text/nfl` / `text/nfl-betting` / `text/home-dynasty-
//           league` were added as roots specifically to cover their `.sql` files
//           and contributed 293 files to `files read` while producing ZERO
//           findings, including with deliberately broken files planted in them --
//           while a direct EXPLAIN of the same corpus found 30 of 63 failing on
//           stale columns from six separate conform clusters plus four genuine
//           SQL bugs no rename explains (repaired in user-base `62ae10580` /
//           `74c127d11`).
//
//           THE BINDING IS THE ROOT, NOT THE FILENAME. A `.sql` file states no
//           transport, so there is nothing in it to read a database out of --
//           which is exactly why filename inference is the tempting answer and
//           the forbidden one. The `--root` it was collected under carries the
//           declaration instead: `--root` binds league, `--database-root
//           <database> <path>` binds another, and `--executable-root` binds NONE
//           (it contributes transports that bind themselves per statement, so a
//           bare `.sql` file under it has nothing to inherit) and lands in
//           UNRESOLVED. Same three printed buckets as gate 3, same rule.
//
//           A `.sql` FILE IS NOT PROSE, and admitting it to gate 1 is a measured
//           mistake rather than a stylistic one -- see NON_PROSE_EXTENSIONS.
//
// ADJUDICATIONS, NOT A NAME DENYLIST. Dropped league column names include
// ordinary English words, so a bare-name filter is tempting and is exactly the
// mistake that hid a real defect: `check-renamed-column-consumers` carried a
// stoplist of common names (`total`, `year`, `value`, ...) that suppressed
// precisely the names renames concentrate on, and it returned 129 findings with
// not one of them `total` over a defect that wiped a year of projection values.
// So there is no name filter here. Genuine non-defects are adjudicated per SITE
// in `league-schema-consumer-adjudications.json`, each with a reason, and an
// adjudication that no longer suppresses anything is itself a FINDING -- which is
// what keeps the file from silently becoming a denylist as the corpus moves.
//
// WHAT IS NOT A DEFECT: HISTORY. A migration doc, a task record or an
// observation describing what a rename DID is accurate, and only live
// instruction counts. That distinction is not derivable from the text, so it is
// adjudicated per site with `"kind": "history"` rather than guessed at from a
// path convention -- a path rule would have to assume a doc is wholly historical
// or wholly live, and the corpus's migration docs are neither.
//
// PROSE IS THE CORPUS, SO NOTHING IS STRIPPED. `check-saved-view-param-coverage`
// tokenized comments and so read prose ABOUT a legacy key as a consumer OF it,
// which made four keys permanently unreportable -- the incident note blinded the
// gate to its own incident. That failure was a gate treating prose as coverage.
// Here prose IS the thing under test, so a `table.column` in a sentence is a
// claim about the schema and is checked like any other.
//
// COVERAGE IS REPORTED, NOT IMPLIED. The run always prints how many files were
// read, how many pairs were checked, how many SQL statements EXPLAINed, and --
// the number that matters -- how many statements it could NOT check and why. A
// gate over part of a corpus that reads as full coverage is worse than no gate.
//
// NEGATIVE CONTROL, RUN EVERY TIME. Never accept a green you have not shown can
// go red, so the control is not behind a flag anyone could forget. Each run
// mutates its own oracles in every way this gate is supposed to catch and
// asserts each is reported; a control that stays green FAILS the run. The
// controls need real corpus material to mutate, so they are also what detects
// the extraction going blind -- there is deliberately no minimum-sites constant,
// because that case is already covered by a mechanism that has to work anyway.
//
// Several run in BOTH directions on one input, because half of what this gate
// does is decide that something is NOT a claim about the schema, and an
// over-eager filter fails silently in the direction that looks like success.
// The control that earns its keep most is the one that caught the gate-2
// mutation rewriting a `-- cross-join optimization` COMMENT rather than the
// query: the statement came back semantically identical, EXPLAIN succeeded, and
// the control reported STAYED GREEN over a gate that was working -- failing OPEN,
// which is the one direction a control must never fail.
//
// Usage:
//
//   yarn test:db:up                            # gates 2, 3 and 4 only
//   node db/gates/check-league-schema-consumers.mjs \
//     --root ../../../guideline/nfl --root ../../../text/league \
//     --root ../../../workflow/nfl --executable-root ../../../cli
//
//   node db/gates/check-league-schema-consumers.mjs --gate 1      # no database
//
// A root's `.sql` files bind to league by default. `--database-root <database>
// <path>` binds them elsewhere (printed DATABASE-SCOPED) and `--executable-root`
// binds them to nothing (printed UNRESOLVED).
//
// League roots (`docs/`, `api/swagger/`, `server/crontab-*`) are checked by
// default. The user-base trees live outside this checkout, so they are passed as
// `--root` rather than hardcoded -- this gate is about the league SCHEMA, and the
// corpus is a parameter of the run.
//
// Exit 0 = no findings; 1 = at least one finding or a control that stayed green;
// 2 = tooling error (container down, schema load failed).
//
// Uses console.log deliberately, never `debug` -- the ESM import graph clobbers
// the namespace set before a module-scope `debug.enable` runs, and an oracle
// whose verdict depends on winning that negotiation has no audit trail.

import fs from 'fs'
import fsp from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import Knex from 'knex'

const repo_root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..'
)

// Defaults itself onto the bundled PG16 test container rather than inheriting an
// ambient NODE_ENV that might point at production. This gate only ever reads a
// throwaway database it created itself.
process.env.NODE_ENV = process.env.NODE_ENV || 'test'
process.env.LEAGUE_DB_HOST = process.env.LEAGUE_DB_HOST || '127.0.0.1'
process.env.LEAGUE_DB_PORT = process.env.LEAGUE_DB_PORT || '5433'

// `CLAUDE.md` is in the corpus because it is the densest schema-claiming prose in
// the repo and is read as instruction by every session. It is also the file with
// the highest history-to-defect ratio — a 2026-08-05 audit found 21 absent
// (table, column) pairs in it of which only 8 were defects — which is why the
// adjudication surface had to exist before it could be included.
const DEFAULT_ROOTS = [
  'CLAUDE.md',
  'docs',
  'api/swagger',
  'server/crontab-main',
  'server/crontab-worker-1',
  // This repository's own executable SQL, gate 3 only. These are DEFAULT rather
  // than arguments because they are inside the checkout: the roots are a
  // parameter of the run only for the corpus that lives outside it. `prose` is
  // empty, so gate 1's prose derivation never sees them — the same measured
  // split that keeps user-base `.mjs` out of it.
  {
    path: 'scripts',
    extensions: new Set(['.mjs']),
    prose_extensions: new Set()
  },
  {
    path: 'libs-server',
    extensions: new Set(['.mjs']),
    prose_extensions: new Set()
  },
  { path: 'jobs', extensions: new Set(['.mjs']), prose_extensions: new Set() }
]

// `.sh` and `.mjs` are here for GATE 3. A shell script holding SQL in a bash
// variable, and a script POSTing SQL to `/api/db/<database>/query`, are both
// EXECUTABLE schema consumers rather than documentation -- see the gate 3 header
// for why they belong in this gate rather than in one of their own. `.sql` is
// here for GATE 4.
const SCANNED_EXTENSIONS = new Set(['.md', '.mjs', '.cron', '.sql', '.sh'])

// Extensions gate 1 may never read as prose, whatever root supplies them. This
// is the same measured exclusion that keeps `.mjs` out of the prose derivation,
// reached through a different mechanism: in a `.sql` file a dotted pair is an
// ALIAS-qualified column reference, and the alias is routinely a CTE named after
// the table it derives from. `player_gamelogs.count` inside `WITH ...,
// player_gamelogs AS (SELECT count(*) ...)` is correct SQL and gate 1 reads it as
// a claim that the physical table has a `count` column. Measured 2026-08-18 over
// the runner's own root list: **141 of the gate's 161 findings** were this shape,
// across five `text/nfl-betting/2023/*.sql` archives, and NOT ONE was a real
// stale reference. EXPLAIN resolves the alias through the statement's own WITH
// clause for free, which is what gate 4 is for -- so the prose derivation gives
// up nothing it could correctly answer.
const NON_PROSE_EXTENSIONS = new Set(['.sql'])

// The database a root's `.sql` files are bound to. Declared per root because a
// `.sql` file states no transport -- gate 3's three extractions each read their
// database out of the statement's own text (`psql -d`, `/api/db/<x>/query`, a
// `#db` import), and a bare file has none of those. `null` means the root
// declares nothing, which is UNRESOLVED rather than a guess.
const LEAGUE_DATABASE = 'league_production'

const adjudications_file = path.join(
  repo_root,
  'db/gates/league-schema-consumer-adjudications.json'
)

// ---------------------------------------------------------------------------
// schema.postgres.sql
// ---------------------------------------------------------------------------

// Parses CREATE TABLE bodies out of the exported schema. Views are collected by
// NAME only: a view's output columns come from its SELECT list, which a name-only
// parse of the dump cannot state, so gate 1 must not judge `view_x.column` at all
// -- it would report every column of every view as absent. Gate 2 handles views
// correctly for free, because the real database knows them.
const parse_schema = (sql) => {
  const tables = new Map()
  const table_re =
    /CREATE TABLE (?:IF NOT EXISTS )?(?:public\.)?"?([a-z0-9_]+)"?\s*\(([\s\S]*?)\n\);/gi
  let match
  while ((match = table_re.exec(sql))) {
    const columns = new Set()
    for (const raw_line of match[2].split('\n')) {
      const line = raw_line.trim()
      const column_match = /^"?([a-z0-9_]+)"?\s+[a-z]/i.exec(line)
      if (!column_match) continue
      if (
        /^(CONSTRAINT|PRIMARY|UNIQUE|FOREIGN|CHECK|EXCLUDE|LIKE|PARTITION)$/i.test(
          column_match[1]
        )
      ) {
        continue
      }
      columns.add(column_match[1])
    }
    tables.set(match[1], columns)
  }

  const views = new Set()
  const view_re = /CREATE (?:OR REPLACE )?VIEW (?:public\.)?"?([a-z0-9_]+)"?/gi
  while ((match = view_re.exec(sql))) views.add(match[1])

  return { tables, views }
}

// ---------------------------------------------------------------------------
// corpus
// ---------------------------------------------------------------------------

const walk_files = (dir, acc = []) => {
  let entries
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return acc
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
      walk_files(full, acc)
    } else if (SCANNED_EXTENSIONS.has(path.extname(entry.name))) {
      acc.push(full)
    }
  }
  return acc
}

// A root declares which extensions it contributes AND which of those gate 1 may
// read as prose. The split is measured rather than stylistic, and it is what lets
// `--executable-root` bring `.mjs` into the corpus for gate 3 without handing it
// to gate 1.
//
// Gate 1's `table.column` derivation is built for PROSE, where a dotted pair is a
// schema claim. In JavaScript it is ordinary property access, and the object name
// collides with a table name often enough to drown the gate: adding `cli/`
// unrestricted produced 64 gate-1 findings, 52 of them `.mjs` property reads like
// `config.degraded` off a local variable, against 10 genuine stale pairs in shell
// COMMENTS. So `.sh` stays prose-eligible (its comments are prose and the ten
// findings were real) and `.mjs` does not.
//
// The measurement that made `.mjs` worth admitting for gate 3 at all: exactly ONE
// user-base `.mjs` queries league, `cli/content/refresh-player-snapshot.mjs`, via
// the only `/api/db/league/query` call site in the repository against six for
// `content-feed`. The surface is HAND-WRITTEN SQL, which gate 3's extractor and
// EXPLAIN already handle -- so it costs one extractor, not the second quoted-
// literal derivation and adjudication pass that was previously prescribed for it.
const collect_corpus = (roots) => {
  const files = []
  const missing = []
  for (const entry of roots) {
    const {
      path: root,
      extensions,
      prose_extensions,
      // A plain `--root` is a league corpus root: gates 1 and 2 already judge
      // everything it supplies against the league schema unconditionally, so
      // that is the declaration this makes explicit rather than a new one.
      database = LEAGUE_DATABASE
    } = typeof entry === 'string'
      ? { path: entry, extensions: null, prose_extensions: null }
      : entry
    const absolute = path.isAbsolute(root) ? root : path.join(repo_root, root)
    if (!fs.existsSync(absolute)) {
      missing.push(root)
      continue
    }
    const permitted = (file) =>
      !extensions || extensions.has(path.extname(file))
    const prose = (file) =>
      !NON_PROSE_EXTENSIONS.has(path.extname(file)) &&
      (!prose_extensions || prose_extensions.has(path.extname(file)))
    // An in-repo root is displayed relative to the REPO, never relative to the
    // root it was collected under -- see `display_path` for why that distinction
    // is load-bearing rather than cosmetic.
    //
    // Decided on where the root RESOLVES TO, not on whether it was typed as an
    // absolute path. `8096a9588` used `!path.isAbsolute(root)` on the stated
    // premise that "external roots are absolute arguments", and they are not:
    // scripts/check-cluster-gates.mjs has always passed the user-base roots
    // relative (`--root ../../../text/league`). So every external file was
    // classified in-repo, keyed as `../../../text/league/...` instead of the
    // basename form its adjudications use, and the run reported ~20 real
    // adjudications as suppressing nothing WHILE re-reporting their findings --
    // the expensive direction, since the remedy that invites is deleting
    // load-bearing suppressions. Control 15 caught it, and the gate had been
    // BLIND on the runner's invocation since; it only ever went green on a
    // hand-typed absolute-root run.
    const relative_to_repo = path.relative(repo_root, absolute)
    const in_repo =
      !relative_to_repo.startsWith('..') && !path.isAbsolute(relative_to_repo)
    // A root may name a single file (`CLAUDE.md`) as well as a directory.
    if (fs.statSync(absolute).isFile()) {
      if (permitted(absolute))
        files.push({
          file: absolute,
          root,
          in_repo,
          absolute_root: path.dirname(absolute),
          prose: prose(absolute),
          database
        })
      continue
    }
    for (const file of walk_files(absolute)) {
      if (permitted(file))
        files.push({
          file,
          root,
          in_repo,
          absolute_root: absolute,
          prose: prose(file),
          database
        })
    }
  }
  return { files, missing }
}

// A corpus path is reported relative to the root it was collected under, so a
// finding in user-base reads as `workflow/nfl/betting/x.md` rather than as a
// twelve-segment absolute path nobody can scan.
//
// An IN-REPO file is displayed relative to the REPO ROOT instead, and that is
// not cosmetic -- this path is the adjudication KEY. Under the root-relative
// form a single-file root resolves its `absolute_root` to the CHECKOUT
// DIRECTORY, so `CLAUDE.md` keyed as `league/CLAUDE.md` from
// `repository/active/league` and as `<worktree-name>/CLAUDE.md` from anywhere
// else. That put the key under the control of a directory name this repo's own
// guidance tells you to vary: run the gate from a clean worktree, as the
// working-tree gates here are all supposed to be run, and every CLAUDE.md
// adjudication suppressed nothing while reporting itself stale -- measured
// 2026-08-08 as 26 findings plus 26 stale adjudications from a tree that is
// GATE OK in the main checkout. A false finding storm is the expensive
// direction: the remedy it invites is deleting load-bearing suppressions.
//
// It also removes a real ambiguity rather than only a hazard. The checkout is
// named `league` and user-base supplies `text/league` as a root, so both
// collapsed onto one `league/` prefix and the two namespaces were already
// sharing keys.
const display_path = (entry) =>
  entry.in_repo
    ? path.relative(repo_root, entry.file)
    : path.join(
        path.basename(entry.absolute_root),
        path.relative(entry.absolute_root, entry.file)
      )

// ---------------------------------------------------------------------------
// gate 1: qualified table.column pairs
// ---------------------------------------------------------------------------

// Suffixes that make `a.b` a filename rather than a qualified column reference.
// This is a structural filter on the SHAPE of the token, not a filter on column
// NAMES -- `config.mjs` and `leagues.format` parse identically to a real pair and
// neither says anything about the schema. It cannot suppress a real finding,
// because no league column is named after a file extension.
const FILE_EXTENSIONS = new Set([
  'mjs',
  'js',
  'cjs',
  'jsx',
  'ts',
  'json',
  'md',
  'sql',
  'sh',
  'yml',
  'yaml',
  'css',
  'styl',
  'py',
  'txt',
  'csv',
  'tsv',
  'gz',
  'log',
  'cron',
  'env',
  'lock',
  'html',
  'htm',
  'xml',
  'png',
  'svg'
])

// Requires both sides adjacent to the dot with no whitespace, which is what
// separates a qualified reference from a sentence boundary (`sources. drive_yds`
// in the manual sweep).
const PAIR_RE = /\b([a-z][a-z0-9_]{2,})\.([a-z][a-z0-9_]*)\b/g

// Structural rejections, applied to the SHAPE of the surrounding text and never
// to the column NAME. Each one is a form in which `a.b` provably is not a
// qualified column reference, so none of them can suppress a real finding:
//
//   `player_gamelogs.snaps_*`   a documented glob — a column name cannot end `*`
//   `playoffs.filter((m) =>`    a JS method call — a column is never called
//   `config/config.sample.json` a path — the surrounding token names a file
//   `test/leagues.format-id-cascade.spec.mjs`  likewise
//
// The path rule reads the whole surrounding token rather than just the two
// segments, because `config.production.js` matches `config.production` and stops
// before ever reaching the extension that gives it away.
const is_structurally_not_a_reference = (line, match) => {
  const after = line[match.index + match[0].length]
  if (after === '*' || after === '(') return true

  const before = line.slice(0, match.index)
  const start =
    before.length - (/[^\s`'"|(),]*$/.exec(before) || [''])[0].length
  const rest = /^[^\s`'"|(),]*/.exec(line.slice(match.index))[0]
  const token = line.slice(start, match.index) + rest

  if (token.includes('/')) return true
  // A `file.ext:line` citation is a source location, not a reference. The line
  // suffix has to come off before the extension test, or `teams.mjs:333` reads as
  // the table `teams` with a column `mjs` — which is how five sites in one design
  // doc were reported on the first run.
  // Everything after the extension comes off: a `:line` citation suffix
  // (`teams.mjs:333`) and trailing markdown emphasis (`**config.production.js**`)
  // both leave the extension attached to punctuation, and both were reported as
  // findings on the first run of this gate.
  // The last NON-EMPTY segment. A filename ending a sentence (`lives in
  // config.json.`) keeps the trailing period inside the token, so a bare `pop()`
  // returns the empty string, the extension test fails, and the filename is
  // reported as a schema claim. That is how `config.json` and `draft.htm` were
  // reported the first time `.sh` files entered the corpus.
  const segments = token
    .split('.')
    .map((segment) => segment.toLowerCase().replace(/[^a-z0-9].*$/, ''))
    .filter(Boolean)
  return FILE_EXTENSIONS.has(segments[segments.length - 1])
}

// `CREATE INDEX ... ON <table> (<columns>)` is a documented claim about a real
// table's real columns that NEITHER derivation could see: the columns are
// unqualified, so the pair regex has no table to bind them to, and DDL is not
// EXPLAINable, so gate 2 files the whole block as uncovered. That left the
// index-naming reference — six blocks whose entire content is such claims — with
// no oracle at all. It is checked here rather than by executing the DDL against
// the throwaway database: the statement is trivially parseable, execution would
// buy nothing beyond it, and running corpus-authored DDL would turn a gate that
// only ever reads into one that runs whatever a document happens to say.
//
// Anything that is not a bare identifier is SKIPPED rather than guessed at — an
// expression index (`lower(name)`), an opclass, or a sort modifier makes the
// column list unparseable, and the safe direction there is no claim.
const CREATE_INDEX_RE =
  /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:CONCURRENTLY\s+)?(?:IF\s+NOT\s+EXISTS\s+)?[a-z0-9_"]+\s+ON\s+(?:ONLY\s+)?(?:public\.)?"?([a-z0-9_]+)"?\s*(?:USING\s+[a-z]+\s*)?\(([^()]*)\)(?:\s*INCLUDE\s*\(([^()]*)\))?/gi

const extract_indexed_column_sites = (source) => {
  const sites = []
  CREATE_INDEX_RE.lastIndex = 0
  let match
  while ((match = CREATE_INDEX_RE.exec(source))) {
    const line = source.slice(0, match.index).split('\n').length
    const listed = `${match[2] || ''},${match[3] || ''}`.split(',')
    for (const raw_column of listed) {
      const column = raw_column.trim().replace(/^"|"$/g, '')
      if (!/^[a-z_][a-z0-9_]*$/.test(column)) continue
      sites.push({
        table: match[1],
        column,
        line,
        context: match[0].replace(/\s+/g, ' ').slice(0, 160)
      })
    }
  }
  return sites
}

const run_gate_1 = ({
  corpus,
  tables,
  views,
  adjudications,
  read_file = (file) => fs.readFileSync(file, 'utf8')
}) => {
  const findings = []
  let pairs_checked = 0
  let pairs_skipped_unknown_table = 0
  let pairs_skipped_view = 0
  let indexed_columns_checked = 0
  let indexed_columns_skipped_unknown_table = 0
  let files_skipped_not_prose = 0
  const files_with_pairs = new Set()

  for (const entry of corpus) {
    // A file its root declared non-prose (user-base `.mjs`) is in the corpus for
    // gate 3 only. Counted rather than quietly dropped, so the exclusion stays
    // visible in the coverage block instead of reading as an empty derivation.
    if (entry.prose === false) {
      files_skipped_not_prose++
      continue
    }
    const source = read_file(entry.file)
    const lines = source.split('\n')
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index]
      PAIR_RE.lastIndex = 0
      let match
      while ((match = PAIR_RE.exec(line))) {
        const [, table, column] = match
        if (is_structurally_not_a_reference(line, match)) continue
        if (views.has(table)) {
          pairs_skipped_view++
          continue
        }
        const columns = tables.get(table)
        if (!columns) {
          pairs_skipped_unknown_table++
          continue
        }
        pairs_checked++
        files_with_pairs.add(entry.file)
        if (columns.has(column)) continue

        const site = {
          gate: 1,
          kind: 'documented_column_absent',
          path: display_path(entry),
          line: index + 1,
          table,
          column,
          detail: `'${table}.${column}' is documented, but '${table}' has no such column`,
          context: line.trim().slice(0, 160)
        }
        const adjudication = match_adjudication(adjudications, site)
        if (adjudication) {
          adjudication.used++
          continue
        }
        findings.push(site)
      }
    }

    for (const indexed of extract_indexed_column_sites(source)) {
      const columns = tables.get(indexed.table)
      if (!columns) {
        indexed_columns_skipped_unknown_table++
        continue
      }
      indexed_columns_checked++
      if (columns.has(indexed.column)) continue

      const site = {
        gate: 1,
        kind: 'documented_column_absent',
        path: display_path(entry),
        line: indexed.line,
        table: indexed.table,
        column: indexed.column,
        detail: `a documented index puts '${indexed.table}' on column '${indexed.column}', which that table does not have`,
        context: indexed.context
      }
      const adjudication = match_adjudication(adjudications, site)
      if (adjudication) {
        adjudication.used++
        continue
      }
      findings.push(site)
    }
  }

  return {
    findings,
    coverage: {
      pairs_checked,
      pairs_skipped_unknown_table,
      pairs_skipped_view,
      indexed_columns_checked,
      indexed_columns_skipped_unknown_table,
      files_skipped_not_prose,
      files_with_pairs: files_with_pairs.size
    }
  }
}

// ---------------------------------------------------------------------------
// gate 2: fenced SQL
// ---------------------------------------------------------------------------

// A fence OPENER has to sit at the start of its line, which is what markdown
// requires and what separates a real block from a sentence that merely names one.
// Unanchored, the prose in `CLAUDE.md` describing this gate ("splits every fenced
// ```sql block") opened a PHANTOM fence that ran to the next inline mention
// several paragraphs away, swallowing the intervening prose and reporting it as
// one or more unrunnable blocks — a gate inventing its own uncovered entries out
// of documentation about itself, and the count moved whenever that prose was
// edited. Indentation is allowed because a fence inside a numbered list is
// legitimately indented, and one of the corpus's real blocks is.
const SQL_FENCE_RE = /^[ \t]*```sql\b[^\n]*\n([\s\S]*?)```/gm
const OTHER_FENCE_RE = /^[ \t]*```(?!sql\b)([a-z]*)\b[^\n]*\n([\s\S]*?)```/gm

// A non-`sql` fence is worth retagging only if it holds a SQL STATEMENT, and
// `SELECT` ... `FROM` appearing ANYWHERE in the block does not establish that.
// The loose form read `.select(` beside the English word "from" as SQL and so
// reported all five of this corpus's ```javascript fences — every one of them
// ordinary JavaScript. Acting on that suggestion would have mislabelled five
// docs and moved five blocks from one uncovered bucket to another, since
// EXPLAIN cannot parse JavaScript either. The test is therefore ANCHORED to
// line starts: a leading statement keyword AND a clause keyword introducing its
// own line. `with:` and `select:` are excluded because an object key is the one
// shape that opens a JavaScript line with a SQL keyword, and it is what both
// surviving false positives were.
const SQL_STATEMENT_OPENER_RE =
  /^[ \t]*(SELECT|WITH|INSERT|UPDATE|DELETE)\b(?!\s*:)/im
const SQL_CLAUSE_LINE_RE =
  /^[ \t]*(FROM|WHERE|GROUP BY|ORDER BY|INNER JOIN|LEFT JOIN|JOIN|UNION)\b/im

const looks_like_a_sql_statement = (block) =>
  SQL_STATEMENT_OPENER_RE.test(block) && SQL_CLAUSE_LINE_RE.test(block)

// Placeholders are substituted with NULL rather than with plausible values on
// purpose. NULL is untyped, so it satisfies a comparison against a column of any
// type -- substituting `2025` for a `{{ year }}` that turns out to sit beside a
// text column would raise a type error this gate would then report as a defect in
// the documentation, which it is not. The cost is that a placeholder in an
// IDENTIFIER position produces a syntax error; those are classified as uncovered
// below rather than reported, which is the safe direction.
const PLACEHOLDER_PATTERNS = [
  /\{\{[^}]*\}\}/g, // {{ year }}
  /\$\{[^}]*\}/g, // ${year}
  // Angle and brace markers are matched in EITHER case. Restricting them to
  // SCREAMING_CASE was an assumption about house style that the corpus does not
  // keep: `{YEAR}` and `{POST_WEEK_NUMBER}` in the weekly-gameplan workflow and
  // `<pid_column>` in CLAUDE.md were left unsubstituted and reported as syntax
  // errors, which is the uncovered bucket that can hide a real defect. Neither
  // widening can swallow valid SQL — `<>` is excluded by requiring a leading
  // letter, and a brace pair is not SQL syntax outside a quoted array literal.
  /<[a-zA-Z_][a-zA-Z0-9_]*>/g, // <YEAR>, <pid_column>
  /\{[a-zA-Z_][a-zA-Z0-9_]*\}/g, // {year}, {YEAR}
  // A braced English PHRASE, which the betting workflows use where the fill-in
  // is a list rather than a name (`IN ({list of defense teams with alignments})`).
  // The required interior space is what separates it from an array literal.
  /\{[a-zA-Z][^{}'"\n]*[ \t][^{}'"\n]*\}/g,
  // A documentation ELLIPSIS standing in for elided values or predicates
  // (`ARRAY['Player1', 'Player2', ...]`, `WHERE ...`). Three dots are never
  // valid SQL, so this cannot suppress anything real.
  /(?<![.\w])\.\.\.(?![.\w])/g,
  /(?<![:\w]):[a-z_][a-z0-9_]*/g, // :name  (not ::cast)
  /\$\d+/g, // $1
  // A quoted SCREAMING_CASE literal, which the betting workflows use as a fill-in
  // marker (`ps.esbid = 'GAME_ESBID'`). The underscore is required on purpose:
  // without it this would swallow `'REG'`, `'POST'` and `'ACT'`, which are real
  // season-type and roster-status values and not placeholders at all.
  /'[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+'/g
]

// A placeholder wedged INTO an identifier names a table or column that only
// exists once the template is rendered — `nfl_plays_year_{{ year }}` is the
// per-season partition, and substituting anything at all produces a relation that
// genuinely does not exist. Such a statement is not checkable and is reported as
// uncovered; reporting it as a finding would be the gate blaming the corpus for
// its own substitution, which is exactly the kind of false positive that trains a
// reader to ignore a gate.
//
// Three shapes qualify, and all three are structural — none reads the
// placeholder's NAME:
//
//   nfl_plays_year_{{ year }}   glued to an identifier on either side
//   count(p.<pid_column>)       the column half of a qualified reference
//   WITH ${table_name} AS       the operand of a relation-introducing keyword
//
// The last two were reported as syntax errors until 2026-08-05. That is the
// same uncovered TOTAL either way, but the reason a reader is given decides
// whether they go looking: "syntax error" invites a search for malformed SQL
// that is not there, while this reason states the statement is unrunnable by
// construction and closes the question.
const IDENTIFIER_POSITION_PREFIX_RE =
  /(?:[a-z0-9_]|\.|\b(?:FROM|JOIN|INTO|UPDATE|TABLE|WITH)[ \t]+)$/i

// Comments are stripped first. These queries document their own parameters, so
// `${year}` appears in the header block long before it appears in the WHERE
// clause, and a mention preceded by a word character there would condemn an
// entirely checkable statement to the uncovered bucket.
const has_identifier_placeholder = (raw_sql) =>
  PLACEHOLDER_PATTERNS.some((pattern) => {
    const sql = strip_block_comments(raw_sql).replace(/--[^\n]*/g, '')
    const scan = new RegExp(pattern.source, 'gi')
    let match
    while ((match = scan.exec(sql))) {
      const after = sql[match.index + match[0].length]
      if (after && /[a-z0-9_]/i.test(after)) return true
      if (IDENTIFIER_POSITION_PREFIX_RE.test(sql.slice(0, match.index)))
        return true
    }
    return false
  })

const substitute_placeholders = (sql) => {
  let out = sql
  let substitutions = 0
  for (const pattern of PLACEHOLDER_PATTERNS) {
    out = out.replace(pattern, () => {
      substitutions++
      return 'NULL'
    })
  }
  // A bare `?` bind marker. Restricted to a position where a value belongs so a
  // question mark in prose inside a SQL comment does not get rewritten.
  out = out.replace(/(?<=[\s(,=])\?(?=[\s),]|$)/gm, () => {
    substitutions++
    return 'NULL'
  })
  return { sql: out, substitutions }
}

// A `/* ... */` comment, which Postgres allows to NEST. Stripped rather than
// parsed wherever this file needs to know whether text is SQL or commentary.
//
// This was absent until 2026-08-18 and the whole cost landed in the UNCOVERED
// bucket, which is where a broken extraction goes to look fine. The standalone
// `.sql` corpus documents its parameters in a leading block comment — 34 of the
// 63 files — and several close with an `Example Usage` block whose prose carries
// semicolons. So the splitter cut statements apart inside prose, the leading
// comment made `EXPLAINABLE_RE` reject a perfectly good SELECT, and a trailing
// comment survived the emptiness filter as a statement of its own: 46 of 144
// extracted statements were filed "not an EXPLAINable statement" over a corpus
// that is almost entirely EXPLAINable. Line comments were handled from the
// start, so nothing looked wrong.
const strip_block_comments = (sql) => {
  let out = ''
  let depth = 0
  let in_string = false
  let in_line_comment = false
  for (let index = 0; index < sql.length; index++) {
    const character = sql[index]
    const next = sql[index + 1]
    if (in_line_comment) {
      if (depth === 0) out += character
      if (character === '\n') in_line_comment = false
      continue
    }
    if (in_string) {
      out += character
      if (character === "'" && next !== "'") in_string = false
      continue
    }
    if (depth > 0) {
      if (character === '/' && next === '*') {
        depth++
        index++
        continue
      }
      if (character === '*' && next === '/') {
        depth--
        index++
        continue
      }
      // Newlines are kept so a caller counting lines is not thrown off.
      if (character === '\n') out += character
      continue
    }
    if (character === '/' && next === '*') {
      depth++
      index++
      continue
    }
    if (character === '-' && next === '-') {
      in_line_comment = true
      out += character
      continue
    }
    if (character === "'") {
      in_string = true
      out += character
      continue
    }
    out += character
  }
  return out
}

// Splits a fenced block into statements on top-level semicolons, respecting
// single-quoted strings and both comment forms. Dollar-quoted bodies are not
// split at all -- a PL/pgSQL body cannot be EXPLAINed and is reported as
// uncovered.
const split_statements = (block) => {
  if (block.includes('$$')) return null
  const statements = []
  let current = ''
  let in_string = false
  let in_line_comment = false
  let block_comment_depth = 0
  for (let index = 0; index < block.length; index++) {
    const character = block[index]
    const next = block[index + 1]
    if (in_line_comment) {
      current += character
      if (character === '\n') in_line_comment = false
      continue
    }
    if (in_string) {
      current += character
      if (character === "'" && next !== "'") in_string = false
      continue
    }
    // Inside a block comment nothing is punctuation: a `;` in prose must not
    // split a statement, and a `'` must not open a string.
    if (block_comment_depth > 0) {
      current += character
      if (character === '/' && next === '*') {
        block_comment_depth++
        current += next
        index++
      } else if (character === '*' && next === '/') {
        block_comment_depth--
        current += next
        index++
      }
      continue
    }
    if (character === '/' && next === '*') {
      block_comment_depth++
      current += character + next
      index++
      continue
    }
    if (character === '-' && next === '-') {
      in_line_comment = true
      current += character
      continue
    }
    if (character === "'") {
      in_string = true
      current += character
      continue
    }
    if (character === ';') {
      statements.push(current)
      current = ''
      continue
    }
    current += character
  }
  statements.push(current)
  return statements
    .map((statement) => statement.trim())
    .filter(
      (statement) =>
        strip_block_comments(statement)
          .replace(/--[^\n]*/g, '')
          .trim().length
    )
}

// A documented query routinely opens with a `-- what this does` line, so the
// leading comments have to come off before asking whether the statement is
// EXPLAINable. Testing the raw text instead classified 72 statements as
// "not an EXPLAINable statement" on the first run of this gate — a blind spot
// twice the size of the corpus it was actually checking, and one that reads as
// coverage in a summary line.
// Both comment forms, interleaved in any order: the standalone `.sql` corpus
// opens on a `/* ... */` parameter block and several files follow it with a
// `-- what this does` line before the SELECT.
const strip_leading_comments = (statement) => {
  let out = statement.trimStart()
  for (;;) {
    if (out.startsWith('--')) {
      const newline = out.indexOf('\n')
      out = newline === -1 ? '' : out.slice(newline + 1).trimStart()
      continue
    }
    if (out.startsWith('/*')) {
      // Nesting-aware, because Postgres nests and a parameter block quoting a
      // nested example would otherwise leave the tail of the comment as SQL.
      let depth = 0
      let index = 0
      while (index < out.length) {
        if (out[index] === '/' && out[index + 1] === '*') {
          depth++
          index += 2
          continue
        }
        if (out[index] === '*' && out[index + 1] === '/') {
          depth--
          index += 2
          if (depth === 0) break
          continue
        }
        index++
      }
      if (depth !== 0) return ''
      out = out.slice(index).trimStart()
      continue
    }
    return out
  }
}

const EXPLAINABLE_RE = /^\s*(SELECT|WITH|INSERT|UPDATE|DELETE|VALUES|TABLE)\b/i

// A doc showing CTE STRUCTURE routinely stops at the last closing paren, with no
// top-level body — `WITH a AS (...), b AS (...)` and nothing after it. Postgres
// calls that `syntax error at end of input`, so a perfectly checkable CTE body
// landed in the same bucket as a genuinely malformed query. Supplying the SELECT
// the doc elided is the gate completing its own input rather than judging the
// corpus on it, and it cannot manufacture a finding by itself: the appended
// relation is the last CTE, which exists by construction, so every error still
// comes from a reference the doc actually wrote.
//
// It CAN promote a fragment that was previously unreported into a reported one,
// which is correct and is what the adjudication surface is for — a block
// continuing a CTE chain begun in an earlier block names a relation that is real
// in the doc's narrative and absent from any schema.
const complete_dangling_with = (original) => {
  // Analysed with block comments removed and appended to the ORIGINAL, because
  // this scanner treats `'` as a string opener and `(` as depth: an apostrophe
  // in a `/* Purpose: ... */` header ("the team's own") would otherwise swallow
  // the rest of the query as a string literal.
  const sql = strip_block_comments(original)
  if (!/^\s*WITH\b/i.test(sql)) return null

  const cte_names = []
  let depth = 0
  let in_string = false
  let in_line_comment = false
  let body_start = -1
  // Only the CTE LIST can end; once it has, a later paren returning to depth 0
  // is part of the body and must not move `body_start`. Without this the scan
  // reset `body_start` on EVERY depth-0 close, so a query whose body happens to
  // end on `)` -- `WITH ... SELECT (SELECT COUNT(*) ...), (SELECT COUNT(*) ...)`
  // -- looked like a bare CTE list with an empty tail and had
  // `SELECT * FROM <last_cte>` appended to a statement that already had a body.
  // The result was a syntax error, which lands in the UNCOVERED bucket, so the
  // statement was silently never checked against the schema and the run still
  // read green. Found 2026-08-07 on the user-base lineage-consistency query,
  // which is exactly the shape; it applies to fenced blocks identically.
  let in_cte_list = true

  for (let index = 0; index < sql.length; index++) {
    const character = sql[index]
    if (in_line_comment) {
      if (character === '\n') in_line_comment = false
      continue
    }
    if (in_string) {
      if (character === "'" && sql[index + 1] !== "'") in_string = false
      continue
    }
    if (character === '-' && sql[index + 1] === '-') {
      in_line_comment = true
      continue
    }
    if (character === "'") {
      in_string = true
      continue
    }
    if (character === '(') {
      depth++
      continue
    }
    if (character === ')') {
      depth--
      // A comma after the close means another CTE follows; anything else ends
      // the list and starts the body.
      if (depth === 0 && in_cte_list) {
        const rest = sql.slice(index + 1).replace(/^(?:\s|--[^\n]*\n)*/, '')
        if (!rest.startsWith(',')) {
          in_cte_list = false
          body_start = index + 1
        }
      }
      continue
    }
    if (depth !== 0) continue
    if (!in_cte_list) continue
    const opener =
      /^([a-z_][a-z0-9_]*)[ \t\n]+AS[ \t\n]*(?:(?:NOT[ \t\n]+)?MATERIALIZED[ \t\n]*)?\(/i.exec(
        sql.slice(index)
      )
    if (!opener) continue
    cte_names.push(opener[1])
    index += opener[0].length - 1
    depth++
  }

  if (depth !== 0 || !cte_names.length || body_start < 0) return null
  const tail = sql
    .slice(body_start)
    .replace(/--[^\n]*/g, '')
    .trim()
  if (tail.length) return null
  return `${original}\nSELECT * FROM ${cte_names[cte_names.length - 1]}`
}

// EXPLAIN error classes. A statement this gate could not put into EXPLAINable
// shape raises a SYNTAX error (42601), which says nothing about the schema and is
// counted as uncovered. Everything else is a real disagreement between the
// documented SQL and the schema -- 42703 undefined_column and 42P01
// undefined_table are the rename shapes, and 42803 grouping_error is what caught
// the reference query in `text/league/data-model-reference.md` that had a GROUP BY
// with no aggregates.
const UNCOVERED_ERROR_CODES = new Set(['42601'])

const collect_sql_blocks = (
  corpus,
  read_file = (file) => fs.readFileSync(file, 'utf8')
) => {
  const statements = []
  const uncovered = []
  let sql_fences = 0
  let sql_like_non_sql_fences = 0

  for (const entry of corpus) {
    const source = read_file(entry.file)
    const relative = display_path(entry)

    // Line number of a fence, so a finding points at the block rather than the
    // file. Counted by slicing the source at the match index, which is exact.
    SQL_FENCE_RE.lastIndex = 0
    let match
    while ((match = SQL_FENCE_RE.exec(source))) {
      sql_fences++
      const line = source.slice(0, match.index).split('\n').length
      const split = split_statements(match[1])
      if (!split) {
        uncovered.push({
          path: relative,
          line,
          reason: 'dollar-quoted body; cannot be EXPLAINed'
        })
        continue
      }
      for (const original of split) {
        const raw = strip_leading_comments(original)
        if (!EXPLAINABLE_RE.test(raw)) {
          uncovered.push({
            path: relative,
            line,
            reason: `not an EXPLAINable statement (${raw.trim().split(/\s+/)[0] || 'empty'})`
          })
          continue
        }
        if (has_identifier_placeholder(raw)) {
          uncovered.push({
            path: relative,
            line,
            reason:
              'template placeholder sits inside an identifier (a rendered table name); ' +
              'no substitution can make this EXPLAINable'
          })
          continue
        }
        // `raw` stays the doc's own text — it is what a finding quotes and what
        // a gate-2 adjudication keys on, so the completion must not leak into it.
        const { sql, substitutions } = substitute_placeholders(
          complete_dangling_with(raw) || raw
        )
        statements.push({ path: relative, line, sql, raw, substitutions })
      }
    }

    OTHER_FENCE_RE.lastIndex = 0
    while ((match = OTHER_FENCE_RE.exec(source))) {
      if (!looks_like_a_sql_statement(match[2])) continue
      sql_like_non_sql_fences++
      uncovered.push({
        path: relative,
        line: source.slice(0, match.index).split('\n').length,
        reason: `SQL inside a \`\`\`${match[1] || 'plain'} fence; retag it \`\`\`sql to bring it under gate 2`
      })
    }
  }

  return { statements, uncovered, sql_fences, sql_like_non_sql_fences }
}

// ---------------------------------------------------------------------------
// gate 3: executable SQL, bound to the database its transport names
// ---------------------------------------------------------------------------

// WHY THIS IS IN THIS GATE AND NOT ITS OWN.
//
// `87066b585` fixed `cli/monitoring/check-league-lineage-consistency.sh` in
// user-base, which had been exiting 1 nightly since the season_grain conform: it
// queried `year` on `transactions` and `rosters_players` from a bash variable
// shipped over ssh to psql. NO gate's corpus contained it. This gate already
// reaches outside the checkout -- it is the only one that does, and its roots are
// arguments precisely because the corpus is a parameter of the run -- but its two
// derivations could not see this file. Gate 1 reads QUALIFIED `table.column`
// tokens and the script writes unqualified references and two-letter aliases
// (`rp.year`, where `rp` is bound in the FROM clause). Gate 2 reads fenced
// ```sql blocks and a bash variable is not a fence.
//
// The oracle that DOES work is the one gate 2 already owns: EXPLAIN. It resolves
// `rp.year` through the statement's own FROM clause and it resolves unqualified
// references, both for free, which is exactly what neither regex derivation can
// do. So gate 3 is a third EXTRACTION feeding the SAME oracle, adjudication file,
// scratch database and coverage discipline -- not a second gate provisioning its
// own database to answer the same question.
//
// THE CORPUS IS NOT CONTENT-GATED, and that is the design decision worth stating.
// The obvious scoping -- "files under cli/ that mention a league table" -- makes
// the DENOMINATOR move with the content, so a file silently leaves the corpus at
// the exact moment its table reference is renamed away, which is the failure mode
// this gate exists to catch. Instead the corpus is every `.sh` under the supplied
// roots, mechanically; files carrying no SQL contribute nothing and are counted.
// The coverage block prints the denominator so a derivation going blind shows up
// as a number falling rather than as a green.
//
// THE DATABASE BINDING, which is what makes a mixed corpus safe. Until 2026-08-07
// this gate judged every statement it extracted against the LEAGUE schema no
// matter which database that statement runs against. `check-nano-*` query the
// nano-community archive and landed in the UNCOVERED bucket only because they
// assemble their projection at runtime (`SELECT $(IFS=,; echo "${select_parts[*]}")`)
// -- luck rather than design, and a hand-written query against a non-league
// database WOULD have been reported as league schema drift. There are three such
// databases in the corpus today, not one: `nano_community_archive`,
// `nano_production`, and `finance_production` in the two `cli/finance` scripts.
//
// So a statement is bound to the database its TRANSPORT names, and every
// transport in this corpus states it in text already being read:
//
//   .sh    the `psql -d <target>` that executes the SQL. Resolved through simple
//          `VAR="literal"` and `VAR="${X:-literal}"` assignments -- which is
//          enough for every SQL-carrying shell script in the corpus.
//   .mjs   the `/api/db/<database>/query` endpoint, which names its database in
//          the path, per call site rather than per file.
//
// Nothing here reads a FILENAME. That `check-league-*.sh` and `league_production`
// agree is a coincidence this resolver cannot see, which is precisely what lets
// the same rule separate `check-nano-archive-fresh.sh` correctly and what keeps
// this from being the name filter CLAUDE.md forbids.
//
// A target that resolves to a non-league database goes to DATABASE-SCOPED. A
// target that cannot be reduced to a literal goes to UNRESOLVED --
// `check-index-corruption.sh` is the standing example, whose `-d $database` is a
// loop variable. Both are PRINTED, because a statement this gate silently skipped
// and a statement it checked and cleared read identically in a summary line.
//
// Remaining blind spot, unchanged: a rendered identifier (`FROM {{ table }}`) is
// unEXPLAINable by construction and is counted uncovered, same as in gate 2.

// The database whose schema `db/schema.postgres.sql` describes. This is the one
// place a database NAME appears, and it is an oracle declaration rather than a
// filter: it states which database this gate's schema file is a copy of. Anything
// else is reported as DATABASE-SCOPED rather than dropped, so a league database
// that is one day spelled differently surfaces as a visible bucket entry instead
// of a silent skip.
const LEAGUE_DATABASE_NAMES = new Set([LEAGUE_DATABASE])

// A bash variable assignment whose body opens on a SQL statement keyword. The
// body runs to the matching close quote, which is what makes it multi-line --
// `read_query='WITH live_week AS (` ... `)'` is 20 lines in the fixed instance.
// Single quotes are literal in bash; double quotes interpolate, handled below.
const SHELL_ASSIGNMENT_RE =
  /^[ \t]*(?:local[ \t]+|export[ \t]+|declare[ \t]+-[A-Za-z]+[ \t]+)?([A-Za-z_][A-Za-z_0-9]*)=(['"])([\s\S]*?)\2/gm

// `psql ... -c "SELECT ..."`, including a flag cluster (`-tAc "..."`) and the
// escaped-quote form an ssh command string forces (`-c \"...\"`). The opener --
// a quote or a backslash-plus-quote -- is captured as one group so the body ends
// at the matching close rather than at the first quote of either kind. A body
// that does not open on a SQL statement keyword is declined downstream by
// `looks_like_shell_sql`, which is what keeps a `python -c "..."` from being
// read as SQL.
const SHELL_PSQL_INLINE_RE = /-[A-Za-z]*c\b[ \t]+((\\)?["'])([\s\S]*?)\1/g

// A heredoc body, `<<TAG` / `<<'TAG'` / `<<-TAG`, ending at a line holding only
// the tag. There are none carrying SQL in the corpus today (15 `<<EOF`, 8
// `<<'EOF'`, plus JS/PY/USAGE bodies) -- which is why the coverage block prints
// the count found, so the first SQL heredoc someone writes is not silently
// outside the derivation.
const SHELL_HEREDOC_RE =
  /<<-?[ \t]*(['"]?)([A-Za-z_][A-Za-z_0-9]*)\1[^\n]*\n([\s\S]*?)\n[ \t]*\2[ \t]*$/gm

// Bash interpolation reaching into SQL. `${VAR}` is already a shared placeholder
// pattern; a bare `$VAR` is not, and adding it to the shared list would change
// how every fenced block is substituted. Normalised here instead, so the shared
// pipeline stays untouched.
const normalise_shell_interpolation = (sql) =>
  sql.replace(/\$([A-Za-z_][A-Za-z_0-9]*)/g, '{{ $1 }}')

const looks_like_shell_sql = (body) => EXPLAINABLE_RE.test(body.trim())

// A bash assignment whose right-hand side reduces to a bare literal. Two forms
// carry every database target in the corpus: `DB_NAME="league_production"` and
// `ARCHIVE_DB="${ARCHIVE_DB:-nano_community_archive}"`, the second being the
// override-with-a-default idiom the monitoring scripts use. Anything else -- a
// command substitution, a concatenation, an array element -- is deliberately NOT
// reduced, because a resolver that guesses produces a confident binding to the
// wrong schema, and UNRESOLVED is a printed bucket while a wrong binding is not.
const SHELL_LITERAL_ASSIGNMENT_RE =
  /^[ \t]*(?:local[ \t]+|export[ \t]+|declare[ \t]+-[A-Za-z]+[ \t]+)?([A-Za-z_][A-Za-z_0-9]*)=([^\n]*)$/gm

const reduce_shell_rhs = (raw) => {
  let value = raw.trim()
  // Only a wholly-quoted RHS is reduced; a quote in the middle means the value is
  // assembled from parts this resolver does not model.
  if (
    (value.startsWith('"') && value.endsWith('"') && value.length > 1) ||
    (value.startsWith("'") && value.endsWith("'") && value.length > 1)
  ) {
    value = value.slice(1, -1)
  }
  const defaulted =
    /^\$\{[A-Za-z_][A-Za-z_0-9]*:-([A-Za-z_][A-Za-z_0-9]*)\}$/.exec(value)
  if (defaulted) return defaulted[1]
  if (/^[A-Za-z_][A-Za-z_0-9]*$/.test(value)) return value
  return null
}

const collect_shell_variable_literals = (source) => {
  const literals = new Map()
  SHELL_LITERAL_ASSIGNMENT_RE.lastIndex = 0
  let match
  while ((match = SHELL_LITERAL_ASSIGNMENT_RE.exec(source))) {
    const value = reduce_shell_rhs(match[2])
    // Last assignment wins, which is what bash does.
    if (value) literals.set(match[1], value)
    else literals.delete(match[1])
  }
  return literals
}

// Every `-d <target>` on a line that invokes psql, plus the `dbname=` form of a
// connection string. Read per line because that is how every invocation in the
// corpus is written, and because a line-scoped match cannot pick up a `-d` that
// belongs to some other command further down the file.
const PSQL_DASH_D_RE =
  /[ \t]-d[ \t]+("?)(\$\{?[A-Za-z_][A-Za-z_0-9]*\}?|[A-Za-z_][A-Za-z_0-9]*)\1/g
const PSQL_DBNAME_RE =
  /\bdbname=(\$\{?[A-Za-z_][A-Za-z_0-9]*\}?|[A-Za-z_][A-Za-z_0-9]*)/g

const resolve_shell_database_target = (source) => {
  const literals = collect_shell_variable_literals(source)
  const resolved = new Set()
  const unresolvable = []

  const consider = (token) => {
    const variable = /^\$\{?([A-Za-z_][A-Za-z_0-9]*)\}?$/.exec(token)
    if (!variable) {
      resolved.add(token)
      return
    }
    const literal = literals.get(variable[1])
    if (literal) resolved.add(literal)
    else unresolvable.push(token)
  }

  for (const line of source.split('\n')) {
    if (!/\bpsql\b/.test(line)) continue
    for (const pattern of [PSQL_DASH_D_RE, PSQL_DBNAME_RE]) {
      pattern.lastIndex = 0
      let match
      while ((match = pattern.exec(line))) consider(match[match.length - 1])
    }
  }

  // A file whose psql targets include BOTH a resolvable database and an
  // unresolvable variable target is bound to the resolvable one rather than
  // declared UNRESOLVED. `check-league-config-drift.sh` is the standing
  // instance: its inline SQL ships over `-d league_production` while an
  // unrelated `.pgpass` probe on another line connects by `dbname=$d`, and
  // leaving the inline SQL unchecked because of the probe's variable would be
  // the same silent skip this bucket exists to print. UNRESOLVED is reserved
  // for a file with NO resolvable target -- `check-index-corruption.sh`, whose
  // only `-d $database` is a loop variable.
  if (!resolved.size && unresolvable.length) {
    return {
      database: null,
      reason: `psql target ${unresolvable[0]} does not reduce to a literal`
    }
  }
  if (!resolved.size) {
    return {
      database: null,
      reason: 'no psql -d target names a database in this script'
    }
  }
  if (resolved.size > 1) {
    return {
      database: null,
      reason: `script names ${resolved.size} databases (${[...resolved].sort().join(', ')}); a per-statement binding is not derivable`
    }
  }
  return { database: [...resolved][0], reason: null }
}

// Shared by both gate-3 extractors. Splits a body into statements, files the ones
// that cannot be put into EXPLAINable shape as uncovered, and pushes the rest.
const push_extracted_statements = ({
  body,
  line,
  relative,
  shape,
  database,
  statements,
  uncovered,
  normalise = (value) => value
}) => {
  const split = split_statements(normalise(body))
  if (!split) {
    uncovered.push({
      path: relative,
      line,
      reason: `${shape}: dollar-quoted body; cannot be EXPLAINed`
    })
    return
  }
  for (const original of split) {
    const raw = strip_leading_comments(original)
    if (!EXPLAINABLE_RE.test(raw)) {
      uncovered.push({
        path: relative,
        line,
        reason: `${shape}: not an EXPLAINable statement (${raw.trim().split(/\s+/)[0] || 'empty'})`
      })
      continue
    }
    if (has_identifier_placeholder(raw)) {
      uncovered.push({
        path: relative,
        line,
        reason: `${shape}: interpolation sits inside an identifier; no substitution can make this EXPLAINable`
      })
      continue
    }
    const { sql, substitutions } = substitute_placeholders(
      complete_dangling_with(raw) || raw
    )
    statements.push({ path: relative, line, sql, raw, substitutions, database })
  }
}

const collect_shell_sql_blocks = (
  corpus,
  read_file = (file) => fs.readFileSync(file, 'utf8')
) => {
  const statements = []
  const uncovered = []
  const database_scoped = []
  const unresolved = []
  const coverage = {
    shell_files: 0,
    assignments: 0,
    psql_inline: 0,
    heredocs_seen: 0,
    heredocs_with_sql: 0,
    files_bound_to_league: 0,
    files_database_scoped: 0,
    files_unresolved: 0
  }

  for (const entry of corpus) {
    if (path.extname(entry.file) !== '.sh') continue
    coverage.shell_files += 1
    const source = read_file(entry.file)
    const relative = display_path(entry)

    // Extraction runs FIRST and binding second, so a script carrying no SQL never
    // reaches the resolver — its target is irrelevant and reporting it would fill
    // both buckets with files that have nothing to check.
    const extracted = []
    const extracted_uncovered = []
    const take = (body, index, shape) =>
      push_extracted_statements({
        body,
        line: source.slice(0, index).split('\n').length,
        relative,
        shape,
        database: null,
        statements: extracted,
        uncovered: extracted_uncovered,
        normalise: normalise_shell_interpolation
      })

    SHELL_ASSIGNMENT_RE.lastIndex = 0
    let match
    while ((match = SHELL_ASSIGNMENT_RE.exec(source))) {
      if (!looks_like_shell_sql(match[3])) continue
      coverage.assignments += 1
      take(match[3], match.index, 'bash assignment')
    }

    SHELL_PSQL_INLINE_RE.lastIndex = 0
    while ((match = SHELL_PSQL_INLINE_RE.exec(source))) {
      if (!looks_like_shell_sql(match[3])) continue
      coverage.psql_inline += 1
      take(match[3], match.index, 'psql -c')
    }

    SHELL_HEREDOC_RE.lastIndex = 0
    while ((match = SHELL_HEREDOC_RE.exec(source))) {
      coverage.heredocs_seen += 1
      if (!looks_like_shell_sql(match[3])) continue
      coverage.heredocs_with_sql += 1
      take(match[3], match.index, 'heredoc')
    }

    if (!extracted.length && !extracted_uncovered.length) continue

    const { database, reason } = resolve_shell_database_target(source)
    const sites = [...extracted, ...extracted_uncovered]
    if (!database) {
      coverage.files_unresolved += 1
      for (const site of sites)
        unresolved.push({ path: site.path, line: site.line, reason })
      continue
    }
    if (!LEAGUE_DATABASE_NAMES.has(database)) {
      coverage.files_database_scoped += 1
      for (const site of sites)
        database_scoped.push({ path: site.path, line: site.line, database })
      continue
    }
    coverage.files_bound_to_league += 1
    for (const site of extracted) statements.push({ ...site, database })
    uncovered.push(...extracted_uncovered)
  }

  return { statements, uncovered, database_scoped, unresolved, coverage }
}

// ---------------------------------------------------------------------------
// gate 3, second transport: SQL POSTed to `/api/db/<database>/query`
// ---------------------------------------------------------------------------

// The endpoint names its database in the PATH, so the binding is per call site
// rather than per file — one script may legitimately query two databases, and
// this transport says which on every call.
const API_QUERY_ENDPOINT_RE = /['"`]\/api\/db\/([a-z0-9_-]+)\/query['"`]/g

// The endpoint's path segment is the base INSTANCE key (`config.databases.
// instances.<key>` in user-base), not the Postgres database name -- the league
// instance is reached as `/api/db/league/query` and resolves to
// `league_production`. So this transport needs its own spelling of "league",
// declared here beside the endpoint it belongs to rather than folded into
// LEAGUE_DATABASE_NAMES, where it would read as a second name for the same
// thing. Every other instance key (`content-feed`, `finance`, `parcels`, ...)
// is DATABASE-SCOPED by the same rule that scopes the nano scripts.
const LEAGUE_API_INSTANCE_NAMES = new Set(['league'])

// Reads one JavaScript string or template literal starting at `index`. Returns
// null for anything else, which is the safe direction: an unread argument is an
// extraction that did not happen, and the coverage block prints the difference
// between endpoints seen and statements taken.
const read_javascript_string_literal = (source, index) => {
  const quote = source[index]
  if (quote !== '`' && quote !== "'" && quote !== '"') return null
  let value = ''
  for (let cursor = index + 1; cursor < source.length; cursor++) {
    const character = source[cursor]
    if (character === '\\') {
      value += source[cursor + 1]
      cursor++
      continue
    }
    if (character === quote) return { value, end: cursor }
    if (quote !== '`' && character === '\n') return null
    value += character
  }
  return null
}

// `sql: QUERY` is the shape the one live call site uses, so an identifier has to
// resolve to its module-level declaration or the statement is simply not
// extracted. Deliberately does not follow reassignment or imports: a value this
// cannot read is uncovered, not guessed.
const resolve_module_constant = (source, name) => {
  const declaration = new RegExp(
    `(?:^|\\n)[ \\t]*(?:const|let|var)[ \\t]+${name}[ \\t]*=[ \\t]*`
  ).exec(source)
  if (!declaration) return null
  const literal = read_javascript_string_literal(
    source,
    declaration.index + declaration[0].length
  )
  return literal ? literal.value : null
}

const collect_api_query_sql_blocks = (
  corpus,
  read_file = (file) => fs.readFileSync(file, 'utf8')
) => {
  const statements = []
  const uncovered = []
  const database_scoped = []
  const coverage = {
    javascript_files: 0,
    endpoints_seen: 0,
    endpoints_bound_to_league: 0,
    endpoints_database_scoped: 0,
    sql_arguments_read: 0
  }

  for (const entry of corpus) {
    if (path.extname(entry.file) !== '.mjs') continue
    if (entry.prose !== false) continue
    coverage.javascript_files += 1
    const source = read_file(entry.file)
    const relative = display_path(entry)

    // Collected up front rather than iterated live, because each call site needs
    // to look ahead to the NEXT one to bound its own argument window, and doing
    // that on the iterating regex leaves its `lastIndex` describing a position
    // the loop never agreed to.
    API_QUERY_ENDPOINT_RE.lastIndex = 0
    const call_sites = []
    let match
    while ((match = API_QUERY_ENDPOINT_RE.exec(source))) {
      call_sites.push({
        database: match[1],
        end: match.index + match[0].length
      })
    }

    for (let index = 0; index < call_sites.length; index++) {
      const site = call_sites[index]
      coverage.endpoints_seen += 1
      const { database } = site
      const line = source.slice(0, site.end).split('\n').length
      if (!LEAGUE_API_INSTANCE_NAMES.has(database)) {
        coverage.endpoints_database_scoped += 1
        database_scoped.push({ path: relative, line, database })
        continue
      }
      coverage.endpoints_bound_to_league += 1

      // The `sql` argument of THIS call: searched forward from the endpoint
      // literal but stopped at the next endpoint, so a file with several calls
      // cannot attribute one call's SQL to another's database.
      const window = source.slice(
        site.end,
        index + 1 < call_sites.length
          ? call_sites[index + 1].end
          : source.length
      )
      const property = /\bsql[ \t]*:[ \t]*/.exec(window)
      if (!property) {
        uncovered.push({
          path: relative,
          line,
          reason:
            '/api/db/league/query call has no readable `sql` argument; nothing extracted'
        })
        continue
      }
      const value_at = property.index + property[0].length
      const literal = read_javascript_string_literal(window, value_at)
      let body = literal ? literal.value : null
      if (!body) {
        const identifier = /^([A-Za-z_$][A-Za-z0-9_$]*)/.exec(
          window.slice(value_at)
        )
        if (identifier) body = resolve_module_constant(source, identifier[1])
      }
      if (!body) {
        uncovered.push({
          path: relative,
          line,
          reason:
            'the `sql` argument is not a literal this gate can resolve; nothing extracted'
        })
        continue
      }
      coverage.sql_arguments_read += 1
      push_extracted_statements({
        body,
        line,
        relative,
        shape: '/api/db/league/query',
        database: 'league_production',
        statements,
        uncovered
      })
    }
  }

  return { statements, uncovered, database_scoped, coverage }
}

// ---------------------------------------------------------------------------
// gate 3, third transport: SQL handed to `<binding>.raw()` in this checkout
// ---------------------------------------------------------------------------

// WHY THIS TRANSPORT EXISTS. Gate 3's first two transports reach OUTSIDE this
// checkout, and that asymmetry left this repository's own hand-written SQL in no
// gate at all. `check-knex-column-resolution` parses knex BUILDERS and gate 1
// reads `'table.column'` literals; a bare column inside a `concat_ws` in a
// template literal is neither, so `refresh-roster-asset-lineage.mjs`'s
// fingerprint kept naming `transactions.timestamp` after the 2026-08-07 conform
// renamed it to `occurred_at` and no gate could see it (fixed in `34a7a40f5`).
// EXPLAIN resolves that shape for free, exactly as it does for a bash variable.
//
// THE BINDING READS AN IMPORT, NOT A PATH. A file that imports `#db` is talking
// to the league database -- that is the transport stating its target, the same
// rule as `psql -d` and `/api/db/<database>/query`, and it reads no FILENAME. It
// is also why this needs no root allowlist to keep user-base `.mjs` out of it:
// `cli/content/refresh-player-snapshot.mjs` reaches league over the API endpoint
// and imports no `#db`, so it cannot be swept in here by accident. A file that
// yields SQL with no `#db` import goes to UNRESOLVED and is printed --
// `libs-server/view-organization/toggle-favorite.mjs` is the standing example,
// taking its `db` as a function parameter.
//
// WHAT IS EXTRACTED, measured rather than assumed. Of 378 `.raw(` call sites in
// `scripts`, `libs-server` and `jobs`, only 21 hand a literal that is a complete
// statement; the rest are expression FRAGMENTS (`count(*) as count`,
// `total_checks + 1`) which are not EXPLAINable on their own and are counted, not
// judged. A further 15 statements live in module-level template constants
// (`const fingerprint_sql = ...`), which is the shape the lineage defect had, so
// those are read too. Sizing a second oracle for the 357 fragments would have
// been sizing the fix to an assumed surface -- the fragments have no FROM clause,
// so no oracle can bind their columns to a table without inventing one.
const DB_RAW_CALL_RE = /\b([A-Za-z_$][A-Za-z0-9_$]*)\.raw\(/g

// A `const NAME = ` whose value opens a template or quoted literal, at any
// indentation. Restricting this to column 0 was the first draft and it cost 13 of
// the 15 real SQL constants in the corpus -- `export-weekly-market-review.mjs`
// and `update-market-settlement-status.mjs` declare theirs inside a function.
// The worry that drove the restriction (a log-line template being read as SQL)
// is already carried by `EXPLAINABLE_RE`, which a log line cannot pass: nothing
// but a statement opens on SELECT/WITH/INSERT/UPDATE/DELETE.
const MODULE_CONSTANT_RE =
  /(?:^|\n)[ \t]*(?:const|let|var)[ \t]+([A-Za-z_$][A-Za-z0-9_$]*)[ \t]*=[ \t]*(?=['"`])/g

// `import db from '#db'` in any of its spellings. The default binding is what
// `.raw()` is called on; a named-only import (`import { x } from '#db'`) does not
// bind the knex instance and so does not bind the file.
const DB_IMPORT_RE =
  /import[ \t]+([A-Za-z_$][A-Za-z0-9_$]*)[ \t]*(?:,[^\n]*)?from[ \t]*['"]#db['"]/

const collect_db_raw_sql_blocks = (
  corpus,
  read_file = (file) => fs.readFileSync(file, 'utf8')
) => {
  const statements = []
  const uncovered = []
  const unresolved = []
  const coverage = {
    javascript_files: 0,
    raw_call_sites: 0,
    raw_literals_read: 0,
    module_constants_read: 0,
    files_bound_to_league: 0,
    files_unresolved: 0
  }

  for (const entry of corpus) {
    if (path.extname(entry.file) !== '.mjs') continue
    if (entry.prose !== false) continue
    const source = read_file(entry.file)
    // An `/api/db/<database>/query` caller is the OTHER transport's file and it
    // binds per call site; reading it here too would double-report its SQL under
    // a file-scoped binding it does not have.
    if (API_QUERY_ENDPOINT_RE.test(source)) {
      API_QUERY_ENDPOINT_RE.lastIndex = 0
      continue
    }
    coverage.javascript_files += 1
    const relative = display_path(entry)

    // Extraction first, binding second — same order as the shell transport, so a
    // file carrying no SQL never reaches the resolver and cannot fill a bucket.
    const extracted = []
    const extracted_uncovered = []
    const take = (body, index, shape) =>
      push_extracted_statements({
        body,
        line: source.slice(0, index).split('\n').length,
        relative,
        shape,
        database: null,
        statements: extracted,
        uncovered: extracted_uncovered
      })

    DB_RAW_CALL_RE.lastIndex = 0
    let match
    while ((match = DB_RAW_CALL_RE.exec(source))) {
      coverage.raw_call_sites += 1
      let cursor = match.index + match[0].length
      while (/[\s]/.test(source[cursor] || '')) cursor++
      const literal = read_javascript_string_literal(source, cursor)
      if (!literal) continue
      coverage.raw_literals_read += 1
      // A fragment is not a defect and not a statement; `push_extracted_statements`
      // would file it as uncovered noise, 300-odd entries deep, drowning the
      // bucket that has to stay readable. Fragments are counted in
      // `raw_literals_read` minus what reaches the oracle.
      if (!EXPLAINABLE_RE.test(strip_leading_comments(literal.value))) continue
      take(literal.value, match.index, `${match[1]}.raw()`)
    }

    MODULE_CONSTANT_RE.lastIndex = 0
    while ((match = MODULE_CONSTANT_RE.exec(source))) {
      const literal = read_javascript_string_literal(
        source,
        match.index + match[0].length
      )
      if (!literal) continue
      if (!EXPLAINABLE_RE.test(strip_leading_comments(literal.value))) continue
      coverage.module_constants_read += 1
      take(literal.value, match.index, `const ${match[1]}`)
    }

    if (!extracted.length && !extracted_uncovered.length) continue

    const import_match = DB_IMPORT_RE.exec(source)
    const sites = [...extracted, ...extracted_uncovered]
    if (!import_match) {
      coverage.files_unresolved += 1
      for (const site of sites)
        unresolved.push({
          path: site.path,
          line: site.line,
          reason:
            'file hands SQL to `.raw()` but imports no `#db`; its database is not derivable'
        })
      continue
    }
    coverage.files_bound_to_league += 1
    for (const site of extracted)
      statements.push({ ...site, database: 'league_production' })
    uncovered.push(...extracted_uncovered)
  }

  return { statements, uncovered, unresolved, coverage }
}

// ---------------------------------------------------------------------------
// gate 4: standalone `.sql` files, bound to the database their ROOT declares
// ---------------------------------------------------------------------------

// WHY THIS IS A FOURTH EXTRACTION AND NOT A FOURTH GATE. Same argument gate 3
// makes: the oracle that resolves an alias-qualified `pg.snaps_off_pct` through
// the statement's own FROM clause is EXPLAIN, gate 2 already owns it, and a
// second gate provisioning its own scratch database to answer the same question
// would be two answers that can disagree. So this feeds the same oracle, the same
// adjudication file, the same scratch database and the same coverage discipline.
//
// WHAT IT COVERS. `text/nfl/query/**/*.sql` is 63 hand-written analysis queries
// that sessions execute verbatim against league. Measured 2026-08-18, THIRTY of
// them failed an EXPLAIN oracle -- stale columns from at least six separate
// conform clusters plus four genuine SQL bugs no rename explains -- while every
// gate in this file printed GATE OK over the directory. They are repaired now;
// nothing but this stopped them rotting again.
//
// THE BINDING RULE, and why it cannot read the filename. Gate 3's three
// transports each state their database inside the statement's own text. A `.sql`
// file states nothing: it is handed to psql, or pasted into a session, by
// something outside the file. The only honest declaration available is the ROOT
// the file was collected under, which is an argument of the run and therefore a
// deliberate act rather than an inference -- and it keeps the rule this gate's
// header opens with intact, because nothing here reads a NAME. A root binding a
// non-league database sends its files to DATABASE-SCOPED; a root binding none
// sends them to UNRESOLVED. `--executable-root` is the live instance of the
// second: `cli/content/migrations/*.sql` are content-feed migrations sitting
// under a root whose OTHER file types bind themselves per statement, so there is
// nothing for a bare `.sql` file there to inherit and guessing league would judge
// five foreign migrations against the wrong schema.
//
// PLACEHOLDERS ARE THE SHARED ONES. These files template `${year}`,
// `${player_pid}`, `${game_esbid}` and friends, which `PLACEHOLDER_PATTERNS`
// already substitutes for gate 2. A placeholder wedged into an IDENTIFIER
// (`${stat_type}` as a column name) is uncheckable by construction and goes to
// the uncovered bucket rather than being dropped -- same as everywhere else here.
const collect_sql_file_blocks = (
  corpus,
  read_file = (file) => fs.readFileSync(file, 'utf8')
) => {
  const statements = []
  const uncovered = []
  const database_scoped = []
  const unresolved = []
  const coverage = {
    sql_files: 0,
    files_bound_to_league: 0,
    files_database_scoped: 0,
    files_unresolved: 0,
    statements_seen: 0
  }

  for (const entry of corpus) {
    if (path.extname(entry.file) !== '.sql') continue
    coverage.sql_files += 1
    const relative = display_path(entry)

    // Binding is resolved BEFORE extraction, the opposite order from gate 3's
    // shell and `.raw()` transports. There the binding lives in the file, so a
    // file carrying no SQL must not reach the resolver and fill a bucket with
    // nothing to check. Here the binding is a property of the ROOT, so an
    // undeclared root leaves the file unread whether or not its contents parse --
    // and a `.sql` file this gate never opened is exactly what the bucket is for.
    if (!entry.database) {
      coverage.files_unresolved += 1
      unresolved.push({
        path: relative,
        line: 1,
        reason:
          'the root supplying this .sql file declares no database, and a bare .sql file names no transport'
      })
      continue
    }
    if (!LEAGUE_DATABASE_NAMES.has(entry.database)) {
      coverage.files_database_scoped += 1
      database_scoped.push({
        path: relative,
        line: 1,
        database: entry.database
      })
      continue
    }
    coverage.files_bound_to_league += 1

    const source = read_file(entry.file)
    const split = split_statements(source)
    if (!split) {
      uncovered.push({
        path: relative,
        line: 1,
        reason: '.sql file: dollar-quoted body; cannot be EXPLAINed'
      })
      continue
    }

    // Each statement is pushed on its own so a finding points at the statement
    // rather than at the top of a 200-line file. The line is recovered by walking
    // the source forward for each statement's first line, which is exact for the
    // whole corpus and degrades to line 1 rather than to a wrong number.
    let cursor = 0
    for (const statement of split) {
      const anchor = statement.split('\n')[0]
      const at = source.indexOf(anchor, cursor)
      const line = at === -1 ? 1 : source.slice(0, at).split('\n').length
      if (at !== -1) cursor = at + anchor.length
      coverage.statements_seen += 1
      push_extracted_statements({
        body: statement,
        line,
        relative,
        shape: '.sql file',
        database: entry.database,
        statements,
        uncovered
      })
    }
  }

  return { statements, uncovered, database_scoped, unresolved, coverage }
}

// knex formats a query error as `${sql} - ${message}`, so on a multi-line
// documented query the naive `message.split('\n')[0]` is the first line of the
// SELECT and the actual Postgres error is nowhere in the finding. Read the driver
// error underneath instead, and fall back to the tail of the wrapped string.
const explain_error_detail = (error) => {
  const message = error.originalError?.message || error.message || ''
  const tail = message.split('\n').pop()
  return (tail.includes(' - ') ? tail.split(' - ').pop() : tail).trim()
}

const explain_statements = async ({
  db,
  statements,
  adjudications,
  gate = 2
}) => {
  const findings = []
  const uncovered = []
  let explained = 0

  for (const statement of statements) {
    try {
      await db.raw(`EXPLAIN ${statement.sql}`)
      explained++
    } catch (error) {
      if (UNCOVERED_ERROR_CODES.has(error.code)) {
        uncovered.push({
          path: statement.path,
          line: statement.line,
          reason: `syntax error after placeholder substitution (${explain_error_detail(error)})`
        })
        continue
      }
      explained++
      const site = {
        gate,
        kind: 'documented_sql_does_not_execute',
        path: statement.path,
        line: statement.line,
        code: error.code,
        detail: `${explain_error_detail(error)} [${error.code}]`,
        context: statement.raw.trim().slice(0, 200)
      }
      const adjudication = match_adjudication(adjudications, site)
      if (adjudication) {
        adjudication.used++
        continue
      }
      findings.push(site)
    }
  }

  return { findings, uncovered, explained }
}

// ---------------------------------------------------------------------------
// adjudications
// ---------------------------------------------------------------------------

// An adjudication is keyed on the SITE -- file plus the specific pair or the
// specific error -- and never on a column name alone. Judging per (table, column)
// rather than per column is the difference between fixing and breaking:
// `nfl_plays.psr_gsis`/`trg_gsis` survive while `psr_pid`/`trg_pid` became
// `passer_pid`/`target_pid` -- one conform, one table, opposite outcomes.
//
// The `pff_id` pair that used to stand here is no longer an example of anything:
// `player.pff_id` became `pff_player_id` first and the three PFF log tables
// followed on 2026-08-07, so the schema is uniform on one spelling. An asymmetry
// is a fact with a shelf life -- re-check the pair rather than citing a list.
const load_adjudications = () => {
  if (!fs.existsSync(adjudications_file)) return []
  const parsed = JSON.parse(fs.readFileSync(adjudications_file, 'utf8'))
  return parsed.adjudications.map((entry) => ({ ...entry, used: 0 }))
}

const match_adjudication = (adjudications, site) => {
  for (const entry of adjudications) {
    if (entry.gate !== site.gate) continue
    if (entry.path !== site.path) continue
    if (site.gate === 1) {
      if (entry.table === site.table && entry.column === site.column)
        return entry
      continue
    }
    // Gate 2 keys on a substring of the failing statement rather than on a line
    // number, so ordinary edits above the block do not silently un-adjudicate it
    // and, more importantly, an edit that changes the statement DOES.
    if (site.context.includes(entry.statement_contains)) return entry
  }
  return null
}

// ---------------------------------------------------------------------------
// negative control
// ---------------------------------------------------------------------------

// Three deliberate mutations, each an instance of what this gate is supposed to
// catch. The gate-1 and gate-2 cases need real corpus material to mutate, so a
// corpus that stopped being read, a pair extractor that stopped matching, or a
// fence extractor that found no SQL all surface here as STAYED GREEN and fail the
// run -- which is why there is no minimum-sites threshold anywhere in this file.
// The gate-2 control's mutation site has to be found in CODE, never in prose.
// A documented query routinely opens with a `-- cross-join optimization with
// optional filtering` comment, and a bare `.replace(/\b(FROM|JOIN)\s+\w+/i)`
// rewrites the first FROM or JOIN it finds THERE — leaving the statement
// semantically identical, so EXPLAIN succeeds and the control reports STAYED
// GREEN over a gate that is working perfectly. That is the control failing OPEN,
// the one direction a control must never fail, and it fired the moment a
// different corpus statement became the first EXPLAINable one. Skips a match
// preceded on its line by `--`, or sitting inside a single-quoted string.
// `FROM` is not always a relation keyword. `EXTRACT(YEAR FROM CURRENT_DATE)`,
// `SUBSTRING(x FROM 2)` and `TRIM(BOTH ' ' FROM x)` all use it as ARGUMENT
// SEPARATOR, and rewriting one of those produces a SYNTAX error rather than the
// 42P01 the control asserts -- so the control reports STAYED GREEN over a gate
// that is working. That is the mirror image of the comment-and-string case this
// helper already guards, failing closed instead of open, and it blocked the run
// on `check-league-cross-source-counters.sh` whose first `FROM` is inside an
// EXTRACT. Detected by walking back to the nearest unclosed `(` and reading the
// identifier that opened it.
const FUNCTIONS_TAKING_FROM_AS_A_SEPARATOR = new Set([
  'extract',
  'substring',
  'trim',
  'overlay',
  'position'
])

const sits_inside_a_from_taking_function = (sql, index) => {
  let depth = 0
  for (let cursor = index - 1; cursor >= 0; cursor--) {
    const character = sql[cursor]
    if (character === ')') depth++
    else if (character === '(') {
      if (depth === 0) {
        const opener = /([a-z_][a-z0-9_]*)\s*$/i.exec(sql.slice(0, cursor))
        return Boolean(
          opener &&
          FUNCTIONS_TAKING_FROM_AS_A_SEPARATOR.has(opener[1].toLowerCase())
        )
      }
      depth--
    }
  }
  return false
}

const mutate_first_relation_reference = (sql) => {
  const pattern = /\b(FROM|JOIN)\s+("?)([a-z0-9_]+)\2/gi
  let match
  while ((match = pattern.exec(sql))) {
    const line_start = sql.lastIndexOf('\n', match.index) + 1
    const preceding = sql.slice(line_start, match.index)
    if (preceding.includes('--')) continue
    if ((preceding.match(/'/g) || []).length % 2 === 1) continue
    if (sits_inside_a_from_taking_function(sql, match.index)) continue
    return (
      sql.slice(0, match.index) +
      `${match[1]} __negative_control_absent__` +
      sql.slice(match.index + match[0].length)
    )
  }
  return null
}

const run_negative_control = async ({
  corpus,
  tables,
  views,
  db,
  statements,
  shell_statements = [],
  db_raw_statements = [],
  sql_file_statements = []
}) => {
  const cases = []

  // 1. gate 1: a column renamed out from under a documented pair. Mutates the
  //    parsed column set rather than the corpus, which is the same drift seen
  //    from the other side and needs no file edit.
  {
    const baseline = run_gate_1({ corpus, tables, views, adjudications: [] })
    let victim = null
    const mutated = new Map()
    for (const [table, columns] of tables) mutated.set(table, new Set(columns))

    // Pick a pair the corpus actually documents and that currently RESOLVES, so
    // the mutation is the only reason it can be reported.
    const find_victim = () => {
      for (const entry of corpus) {
        // Must match what gate 1 actually reads. A victim picked from a file gate
        // 1 skips as non-prose can never be reported, so the mutation would look
        // like a gate that stopped working — a control failing OPEN.
        if (entry.prose === false) continue
        const source = fs.readFileSync(entry.file, 'utf8')
        PAIR_RE.lastIndex = 0
        let match
        while ((match = PAIR_RE.exec(source))) {
          const [, table, column] = match
          if (views.has(table)) continue
          const columns = mutated.get(table)
          if (!columns || !columns.has(column)) continue
          return { table, column }
        }
      }
      return null
    }

    victim = find_victim()
    if (victim) {
      const columns = mutated.get(victim.table)
      columns.delete(victim.column)
      columns.add(`${victim.column}__negative_control`)
    }

    if (!victim) {
      cases.push([
        'gate 1 reports a column renamed out from under its doc',
        false
      ])
    } else {
      const mutated_run = run_gate_1({
        corpus,
        tables: mutated,
        views,
        adjudications: []
      })
      const reported = mutated_run.findings.some(
        (finding) =>
          finding.table === victim.table && finding.column === victim.column
      )
      const baseline_silent = !baseline.findings.some(
        (finding) =>
          finding.table === victim.table && finding.column === victim.column
      )
      cases.push([
        `gate 1 reports ${victim.table}.${victim.column} renamed out from under its doc`,
        reported && baseline_silent
      ])
    }
  }

  // 2. gate 1: the extractor still sees a qualified pair at all. A pair regex
  //    that stops matching would make case 1 vacuous by leaving no victim, but
  //    this states the denominator directly.
  {
    const synthetic = [
      {
        file: path.join(repo_root, '__negative_control__.md'),
        root: '.',
        absolute_root: repo_root
      }
    ]
    const control_tables = new Map(tables)
    control_tables.set('player', new Set(['pid']))
    // Both directions in one case. The line carries a real qualified reference
    // that MUST be reported, and beside it every shape the structural filters are
    // supposed to reject -- so a filter that grows too greedy fails the first
    // assertion, and a filter that stops rejecting fails the second. `player.sql`
    // is here by name: `player` is a real table and `sql` is a real extension, so
    // it is the one path shape that survives a filter tested against the matched
    // SPAN rather than the whole surrounding token.
    const control_line =
      'player.negative_control_absent beside db/fixtures/test/player.sql, ' +
      'player.sql, `teams.mjs:333`, **config.production.js**, ' +
      'player_gamelogs.snaps_* and playoffs.filter((m) => m.week)\n'
    const result = run_gate_1({
      corpus: synthetic,
      tables: control_tables,
      views,
      adjudications: [],
      read_file: () => control_line
    })
    const reported = result.findings.some(
      (finding) => finding.column === 'negative_control_absent'
    )
    cases.push(['gate 1 extracts a qualified pair out of prose', reported])
    cases.push([
      'gate 1 rejects paths, citations, globs and method calls on the same line',
      result.findings.length === 1
    ])
  }

  // 3. gate 1: the documented-index check, both directions on one line. The
  //    first assertion fails if the CREATE INDEX parse stops matching — which
  //    would be silent, since an index nobody parses reports nothing — and the
  //    second fails if it starts guessing at an expression index, where the
  //    indexed value is not a column at all and there is no claim to check.
  {
    const synthetic = [
      {
        file: path.join(repo_root, '__negative_control_index__.md'),
        root: '.',
        absolute_root: repo_root
      }
    ]
    const control_tables = new Map(tables)
    control_tables.set('player', new Set(['pid', 'first_name']))
    const control_source =
      'CREATE INDEX idx_a ON player (pid, negative_control_absent) INCLUDE (first_name);\n' +
      'CREATE INDEX idx_b ON player (lower(negative_control_absent));\n'
    const result = run_gate_1({
      corpus: synthetic,
      tables: control_tables,
      views,
      adjudications: [],
      read_file: () => control_source
    })
    cases.push([
      'gate 1 reports a documented index on a column the table does not have',
      result.findings.some(
        (finding) => finding.column === 'negative_control_absent'
      )
    ])
    cases.push([
      'gate 1 reads an index column list without guessing at an expression index',
      result.findings.length === 1 &&
        result.coverage.indexed_columns_checked === 3
    ])
  }

  // 4. gate 2: the retaggable-fence heuristic, both directions on one shape.
  //    This suggestion tells a reader to EDIT a doc, so a loose version does
  //    active harm rather than merely adding noise — and the loose version is
  //    what shipped: `SELECT` and `FROM` anywhere in a block matched `.select(`
  //    beside the English word "from" and named all five ```javascript fences in
  //    the corpus. The first case fails if the anchoring ever stops finding real
  //    SQL, the second if it goes back to reading a query builder as SQL.
  {
    const synthetic = [
      {
        file: path.join(repo_root, '__negative_control_fence__.md'),
        root: '.',
        absolute_root: repo_root
      }
    ]
    const retag_count = (source) =>
      collect_sql_blocks(synthetic, () => source).uncovered.filter((entry) =>
        entry.reason.startsWith('SQL inside a')
      ).length

    const sql_in_a_javascript_fence =
      '```javascript\nSELECT player.pid\nFROM player\n```\n'
    const an_actual_javascript_fence =
      '```javascript\n' +
      "players_query.select('player.pid')\n" +
      '// skip the join when this table is the same as the from table\n' +
      '```\n'

    cases.push([
      'gate 2 reports real SQL sitting in a ```javascript fence',
      retag_count(sql_in_a_javascript_fence) === 1
    ])
    cases.push([
      'gate 2 does not read a JavaScript query builder as a retaggable SQL fence',
      retag_count(an_actual_javascript_fence) === 0
    ])
  }

  // 5. gate 2: the two mechanisms that turn an unrunnable documented block into
  //    a checked one. Both are asserted END TO END — the block must produce a
  //    real 42703 against the real database — because the failure mode of each
  //    is silent and identical: the statement quietly returns to the uncovered
  //    pile, the run still says GATE OK, and the coverage line moves by one.
  if (db) {
    const synthetic = [
      {
        file: path.join(repo_root, '__negative_control_block__.md'),
        root: '.',
        absolute_root: repo_root
      }
    ]
    const undefined_column_reported = async (source) => {
      const blocks = collect_sql_blocks(synthetic, () => source)
      if (blocks.statements.length !== 1) return false
      const result = await explain_statements({
        db,
        statements: blocks.statements,
        adjudications: []
      })
      return result.findings.length === 1 && result.findings[0].code === '42703'
    }

    // A CTE-only fragment: no top-level body, so Postgres calls it a syntax
    // error until the gate supplies the SELECT the doc elided.
    cases.push([
      'gate 2 completes a CTE-only fragment and checks the body it wrote',
      await undefined_column_reported(
        '```sql\nWITH control_cte AS (\n' +
          '  SELECT player.negative_control_absent\n  FROM player\n)\n```\n'
      )
    ])

    // Every fill-in marker in one statement. Any one of them left unsubstituted
    // raises 42601, which this gate counts as UNCOVERED rather than reporting —
    // so a substituter that quietly narrows shows up here and nowhere else.
    cases.push([
      'gate 2 substitutes {YEAR}, <pid> and an elision before EXPLAINing',
      await undefined_column_reported(
        '```sql\nSELECT player.negative_control_absent\nFROM player\n' +
          "WHERE player.nfl_draft_year = {YEAR}\n  AND player.pid = '<pid>'\n" +
          "  AND player.primary_position IN ('QB', ...)\n```\n"
      )
    ])
  }

  // 6. gate 2: an EXPLAIN that must fail. Takes a REAL extracted corpus statement
  //    and points it at a table that does not exist, so it fails only if the
  //    fence extraction, the placeholder substitution and the database are all
  //    working. With no extracted statement there is nothing to mutate and the
  //    case reports STAYED GREEN, which is exactly the blind-gate signal.
  if (db) {
    let reported = false
    let victim = null
    for (const statement of statements) {
      try {
        await db.raw(`EXPLAIN ${statement.sql}`)
      } catch {
        continue
      }
      victim = statement
      const mutated = mutate_first_relation_reference(statement.sql)
      if (!mutated) continue
      try {
        await db.raw(`EXPLAIN ${mutated}`)
      } catch (error) {
        reported = error.code === '42P01'
      }
      break
    }
    cases.push([
      victim
        ? `gate 2 reports a corpus statement pointed at a table that does not exist (${victim.path}:${victim.line})`
        : 'gate 2 reports a corpus statement pointed at a table that does not exist',
      reported
    ])
  }

  // 7. gate 3: the shell extractor still pulls SQL out of a bash assignment, and
  //    still declines a bash assignment that is not SQL. Both directions in one
  //    case, on a synthetic file, because the over-eager direction is the one
  //    that fails toward success -- an extractor that swallowed every quoted
  //    string would hand EXPLAIN arbitrary prose and bury the real findings.
  {
    const synthetic_path = path.join(repo_root, '__negative_control__.sh')
    // The declined lines must NOT open on a SQL keyword: the extractor keys on
    // the opening statement keyword, which is the documented rule, so a "prose"
    // example beginning with SELECT is prose only to a human. Writing one is how
    // this control first reported STAYED GREEN against a working extractor.
    // The `psql -d` line is load-bearing, not decoration: extraction is bound to
    // a resolved database, so a script naming no target lands in UNRESOLVED and
    // yields no statements — which reads exactly like an extractor that stopped
    // matching. This control's subject is the extraction, so it has to satisfy
    // the binding precondition to test it.
    const source = [
      'DB_NAME="league_production"',
      "read_query='SELECT pid FROM player'",
      "MESSAGE='counted the rows and reported them'",
      'GREETING="hello world"',
      `psql -d "$DB_NAME" -At -c "\${read_query}"`
    ].join('\n')
    const extracted = collect_shell_sql_blocks(
      [
        {
          file: synthetic_path,
          root: '.',
          absolute_root: repo_root
        }
      ],
      () => source
    )
    const took_the_sql = extracted.statements.some((statement) =>
      /FROM player/i.test(statement.sql)
    )
    const declined_the_prose = !extracted.statements.some((statement) =>
      /proceed|hello/i.test(statement.sql)
    )
    cases.push([
      'gate 3 extracts SQL from a bash assignment and declines one that is not SQL',
      took_the_sql && declined_the_prose
    ])
  }

  // 7b. gate 3: the inline `psql -c` extractor still sees the two shapes the
  //     bare-`-c` pattern missed -- a flag cluster (`-tAc "..."`) and escaped
  //     quotes inside an ssh string (`-c \"...\"`) -- and still declines a `-c`
  //     whose body is prose. Both directions on one synthetic file, the same
  //     discipline as case 7: an extractor that swallowed every quoted string
  //     would hand EXPLAIN arbitrary prose and bury the real findings. The
  //     binding precondition is satisfied (`DB_NAME="league_production"`), so a
  //     decline here is the extractor's decision, not a file skipped as
  //     UNRESOLVED.
  {
    const synthetic_path = path.join(
      repo_root,
      '__negative_control_psql_c__.sh'
    )
    const source = [
      'DB_NAME="league_production"',
      'rows=$(ssh database "psql -d $DB_NAME -tAc \\"SELECT p.negative_control_absent FROM player p\\"")',
      'res=$(psql -d "$DB_NAME" -tAc "SELECT p.negative_control_absent FROM player p")',
      'greeting=$(psql -d "$DB_NAME" -c "counted the rows and reported them")'
    ].join('\n')
    const run = collect_shell_sql_blocks(
      [{ file: synthetic_path, root: '.', absolute_root: repo_root }],
      () => source
    )
    const took_the_inline_sql =
      run.statements.filter((statement) => /FROM player/i.test(statement.sql))
        .length === 2
    const declined_the_prose = !run.statements.some((statement) =>
      /counted the rows|proceed/i.test(statement.sql)
    )
    cases.push([
      'gate 3 extracts inline psql -c SQL behind a flag cluster or escaped quotes and declines one carrying prose',
      took_the_inline_sql && declined_the_prose
    ])
  }

  // 8. gate 3: an EXPLAIN that must fail, on a REAL extracted shell statement.
  //    This is the case that detects the corpus going away: if no `.sh` root is
  //    supplied, or the extractor stops matching, there is nothing to mutate and
  //    it reports STAYED GREEN rather than passing over an unread tree. That is
  //    the whole reason gate 3 has no minimum-sites threshold either.
  if (db) {
    let reported = false
    let victim = null
    for (const statement of shell_statements) {
      try {
        await db.raw(`EXPLAIN ${statement.sql}`)
      } catch {
        continue
      }
      victim = statement
      const mutated = mutate_first_relation_reference(statement.sql)
      if (!mutated) continue
      try {
        await db.raw(`EXPLAIN ${mutated}`)
      } catch (error) {
        reported = error.code === '42P01'
      }
      break
    }
    cases.push([
      victim
        ? `gate 3 reports a shell statement pointed at a table that does not exist (${victim.path}:${victim.line})`
        : 'gate 3 reports a shell statement pointed at a table that does not exist -- NO SHELL SQL IN CORPUS',
      reported
    ])
  }

  // 9. THE DATABASE BINDING, which is the discriminator this gate now rests on.
  //    Cases 9 and 10 are the SAME synthetic script carrying the SAME
  //    league-invalid column, differing only in the database its `psql -d`
  //    names. One half alone proves nothing: a gate that reports both is the
  //    pre-2026-08-07 behaviour that would call nano SQL league drift, and a gate
  //    that reports neither has simply stopped extracting. Only the pair
  //    separates them.
  if (db) {
    const synthetic_path = path.join(repo_root, '__negative_control_bound__.sh')
    const script = (database) =>
      [
        `DB_NAME="${database}"`,
        "read_query='SELECT p.negative_control_absent FROM player p'",
        `rows=$(psql -d "$DB_NAME" -At -F'|' -c "\${read_query}")`
      ].join('\n')
    const extract = (database) =>
      collect_shell_sql_blocks(
        [{ file: synthetic_path, root: '.', absolute_root: repo_root }],
        () => script(database)
      )

    const league_run = extract('league_production')
    let league_reported = false
    if (league_run.statements.length === 1) {
      const result = await explain_statements({
        db,
        statements: league_run.statements,
        adjudications: [],
        gate: 3
      })
      league_reported =
        result.findings.length === 1 && result.findings[0].code === '42703'
    }
    cases.push([
      'gate 3 reports a league_production script naming a column the table does not have',
      league_reported
    ])

    const nano_run = extract('nano_community_archive')
    cases.push([
      'gate 3 stays SILENT on the identical script bound to nano_community_archive, and buckets it DATABASE-SCOPED',
      nano_run.statements.length === 0 &&
        nano_run.database_scoped.length === 1 &&
        nano_run.database_scoped[0].database === 'nano_community_archive'
    ])
  }

  // 10. An unresolvable target must reach the UNRESOLVED bucket rather than being
  //     judged against the league schema or dropped. `-d $database` off a
  //     function parameter is the live shape (`check-index-corruption.sh`).
  {
    const synthetic_path = path.join(
      repo_root,
      '__negative_control_unresolved__.sh'
    )
    const source = [
      'check_one() {',
      '  local database="$1"',
      "  read_query='SELECT p.negative_control_absent FROM player p'",
      `  psql -d $database -tAc "\${read_query}"`,
      '}'
    ].join('\n')
    const run = collect_shell_sql_blocks(
      [{ file: synthetic_path, root: '.', absolute_root: repo_root }],
      () => source
    )
    cases.push([
      'gate 3 buckets an unresolvable `psql -d $var` target as UNRESOLVED rather than judging or dropping it',
      run.statements.length === 0 &&
        run.database_scoped.length === 0 &&
        run.unresolved.length === 1 &&
        /does not reduce to a literal/.test(run.unresolved[0].reason)
    ])
  }

  // 11. The `/api/db/<database>/query` transport, the same discriminator on the
  //     other extractor. Identical SQL in identical shape — including the
  //     `sql: QUERY` identifier indirection the one live call site actually uses,
  //     so a module-constant resolver that stops resolving fails here rather than
  //     silently emptying the corpus — differing only in the path segment.
  if (db) {
    const synthetic_path = path.join(repo_root, '__negative_control_api__.mjs')
    const script = (database) =>
      [
        'const QUERY = `',
        '  SELECT p.negative_control_absent',
        '    FROM player p',
        '`',
        '',
        'const run = async () =>',
        `  api_mutate('/api/db/${database}/query', 'POST', {`,
        '    sql: QUERY,',
        '    params: []',
        '  })'
      ].join('\n')
    const extract = (database) =>
      collect_api_query_sql_blocks(
        [
          {
            file: synthetic_path,
            root: '.',
            absolute_root: repo_root,
            prose: false
          }
        ],
        () => script(database)
      )

    const league_run = extract('league')
    let league_reported = false
    if (league_run.statements.length === 1) {
      const result = await explain_statements({
        db,
        statements: league_run.statements,
        adjudications: [],
        gate: 3
      })
      league_reported =
        result.findings.length === 1 && result.findings[0].code === '42703'
    }
    cases.push([
      'gate 3 reports an /api/db/league/query call naming a column the table does not have',
      league_reported
    ])

    const feed_run = extract('content-feed')
    cases.push([
      'gate 3 stays SILENT on the identical /api/db/content-feed/query call, and buckets it DATABASE-SCOPED',
      feed_run.statements.length === 0 &&
        feed_run.database_scoped.length === 1 &&
        feed_run.database_scoped[0].database === 'content-feed'
    ])
  }

  // 12. The `.raw()` transport, same discriminator a third time. The pair here is
  //     an `#db` import against no `#db` import, because that is what binds this
  //     transport -- identical SQL, identical shape, one bound to league and one
  //     landing in UNRESOLVED. A gate reporting both would be judging any repo's
  //     JavaScript against the league schema; a gate reporting neither has stopped
  //     extracting.
  if (db) {
    const synthetic_path = path.join(repo_root, '__negative_control_raw__.mjs')
    const script = (import_line) =>
      [
        import_line,
        '',
        'const run = async () =>',
        '  db.raw(`',
        '    SELECT p.negative_control_absent',
        '      FROM player p',
        '  `)'
      ].join('\n')
    const extract = (import_line) =>
      collect_db_raw_sql_blocks(
        [
          {
            file: synthetic_path,
            root: '.',
            absolute_root: repo_root,
            prose: false
          }
        ],
        () => script(import_line)
      )

    const bound_run = extract("import db from '#db'")
    let bound_reported = false
    if (bound_run.statements.length === 1) {
      const result = await explain_statements({
        db,
        statements: bound_run.statements,
        adjudications: [],
        gate: 3
      })
      bound_reported =
        result.findings.length === 1 && result.findings[0].code === '42703'
    }
    cases.push([
      'gate 3 reports a `#db`-importing script whose .raw() names a column the table does not have',
      bound_reported
    ])

    const unbound_run = extract("import something from '#libs-server'")
    cases.push([
      'gate 3 stays SILENT on the identical .raw() with no `#db` import, and buckets it UNRESOLVED',
      unbound_run.statements.length === 0 && unbound_run.unresolved.length === 1
    ])
  }

  // 13. Both directions of the .raw() extraction on one input. The over-eager
  //     direction is the one that fails toward success: 357 of this repo's 378
  //     `.raw()` arguments are expression FRAGMENTS with no FROM clause, so an
  //     extractor that took them would hand EXPLAIN 357 syntax errors and bury
  //     the uncovered bucket that has to stay readable. The declined lines are
  //     the real shapes -- a `concat_ws` fragment, a counter expression, and a
  //     template that is a log line rather than SQL.
  {
    const synthetic_path = path.join(
      repo_root,
      '__negative_control_raw_shapes__.mjs'
    )
    const source = [
      "import db from '#db'",
      '',
      'const fingerprint_sql = `',
      "SELECT md5(concat_ws(':', uid, tid, pid)) FROM transactions WHERE lid = ?",
      '`',
      '',
      "const counter = db.raw('total_checks + 1')",
      'const projection = db.raw("concat_ws(\':\', uid, tid)")',
      'const message = `processed the rows and reported them`',
      '',
      'const run = async () => db.raw(fingerprint_sql, [1])'
    ].join('\n')
    const run = collect_db_raw_sql_blocks(
      [
        {
          file: synthetic_path,
          root: '.',
          absolute_root: repo_root,
          prose: false
        }
      ],
      () => source
    )
    // The constant is the shape the lineage fingerprint had, and reading it is
    // the whole reason this transport exists: the defect it was written for was a
    // stale bare column inside a `concat_ws`, in a template literal, which no
    // other gate here can resolve.
    const took_the_constant = run.statements.some((statement) =>
      /FROM transactions/i.test(statement.sql)
    )
    const declined_the_fragments = !run.statements.some((statement) =>
      /total_checks|processed the rows/i.test(statement.sql)
    )
    cases.push([
      'gate 3 reads a template-literal SQL constant and declines a .raw() expression fragment',
      took_the_constant && declined_the_fragments
    ])
  }

  // 14. An EXPLAIN that must fail, on a REAL extracted `.raw()` statement. Scoped
  //     to this transport on purpose: case 8 iterates the MERGED executable list,
  //     so it still passes on a shell statement when the `.raw()` extraction has
  //     gone blind. This one reports STAYED GREEN in that case, which is the
  //     signal, and it is why there is no minimum-sites constant here either.
  if (db) {
    let reported = false
    let victim = null
    for (const statement of db_raw_statements) {
      try {
        await db.raw(`EXPLAIN ${statement.sql}`)
      } catch {
        continue
      }
      victim = statement
      const mutated = mutate_first_relation_reference(statement.sql)
      if (!mutated) continue
      try {
        await db.raw(`EXPLAIN ${mutated}`)
      } catch (error) {
        reported = error.code === '42P01'
      }
      break
    }
    cases.push([
      victim
        ? `gate 3 reports a .raw() statement pointed at a table that does not exist (${victim.path}:${victim.line})`
        : 'gate 3 reports a .raw() statement pointed at a table that does not exist -- NO .raw() SQL IN CORPUS',
      reported
    ])
  }

  // 15. The reported path IS the adjudication key, so it must not depend on what
  //     the checkout is NAMED. This asserts the absence of a leak rather than the
  //     presence of a finding, which is the same shape as the DATABASE-SCOPED
  //     silence controls above and for the same reason: half of a key's
  //     correctness is what it does NOT encode. Under the root-relative form a
  //     single-file root took its prefix from the checkout directory, so every
  //     CLAUDE.md adjudication suppressed nothing the moment the gate ran from a
  //     worktree -- 26 findings and 26 stale adjudications over a tree that is
  //     GATE OK, on exactly the clean-worktree path this repo prescribes for the
  //     gates that read the working tree. It needs real in-repo material, so a
  //     corpus that stopped collecting the checkout reports STAYED GREEN here.
  {
    const checkout_name = path.basename(repo_root)
    const in_repo_entries = corpus.filter((entry) => entry.in_repo)
    const leaks_the_checkout_name = in_repo_entries.some((entry) =>
      display_path(entry).split(path.sep).includes(checkout_name)
    )
    cases.push([
      in_repo_entries.length
        ? `an in-repo path is keyed on the repo root and stays SILENT on the checkout directory name (${checkout_name})`
        : 'an in-repo path is keyed on the repo root -- NO IN-REPO CORPUS',
      in_repo_entries.length > 0 && !leaks_the_checkout_name
    ])
  }

  // 16. THE ROOT BINDING, gate 4's whole oracle choice, as a PAIR — the same
  //     synthetic `.sql` file carrying the same league-invalid column, differing
  //     only in the database its ROOT declares. Same reasoning as cases 9/10 and
  //     11: a gate that reports both is judging every corpus's SQL against the
  //     league schema, a gate that reports neither has stopped extracting, and
  //     only the pair separates them. The file also carries a `${year}`
  //     placeholder in a value position, so a substituter that quietly narrows
  //     turns the league half into a 42601 the gate counts as uncovered and this
  //     case reports STAYED GREEN.
  const sql_file_entry = (database) => [
    {
      file: path.join(repo_root, '__negative_control_query__.sql'),
      root: '.',
      absolute_root: repo_root,
      prose: false,
      database
    }
  ]
  // Assembled rather than written literally: eslint's no-template-curly-in-string
  // cannot tell a placeholder the CORPUS writes from a template literal someone
  // quoted by mistake, and this control's whole subject is the first one.
  const placeholder = (name) => `$\{${name}}`
  const sql_file_source =
    'SELECT p.negative_control_absent\n' +
    'FROM player p\n' +
    `WHERE p.nfl_draft_year = ${placeholder('year')}\n`

  if (db) {
    const league_run = collect_sql_file_blocks(
      sql_file_entry(LEAGUE_DATABASE),
      () => sql_file_source
    )
    let league_reported = false
    if (league_run.statements.length === 1) {
      const result = await explain_statements({
        db,
        statements: league_run.statements,
        adjudications: [],
        gate: 4
      })
      league_reported =
        result.findings.length === 1 && result.findings[0].code === '42703'
    }
    cases.push([
      'gate 4 reports a league-root .sql file naming a column the table does not have, after substituting its placeholder',
      league_reported
    ])

    const foreign_run = collect_sql_file_blocks(
      sql_file_entry('nano_community_archive'),
      () => sql_file_source
    )
    cases.push([
      'gate 4 stays SILENT on the identical .sql file under a non-league root, and buckets it DATABASE-SCOPED',
      foreign_run.statements.length === 0 &&
        foreign_run.database_scoped.length === 1 &&
        foreign_run.database_scoped[0].database === 'nano_community_archive'
    ])
  }

  // 17. A root that declares NO database — the `--executable-root` shape, whose
  //     other file types bind themselves per statement. Its `.sql` files must
  //     reach the printed UNRESOLVED bucket rather than being judged against the
  //     league schema or dropped out of the corpus. Dropping them is the failure
  //     that reads as coverage: five content-feed migrations under `cli/` would
  //     simply never appear anywhere in the run.
  {
    const run = collect_sql_file_blocks(
      sql_file_entry(null),
      () => sql_file_source
    )
    cases.push([
      'gate 4 buckets a .sql file under a root declaring no database as UNRESOLVED rather than judging or dropping it',
      run.statements.length === 0 &&
        run.database_scoped.length === 0 &&
        run.unresolved.length === 1
    ])
  }

  // 18. A placeholder wedged into an IDENTIFIER is UNCHECKABLE, and the two ways
  //     to get that wrong are opposite. Reporting it blames the corpus for the
  //     gate's own substitution; dropping it silently shrinks the denominator.
  //     It must land in the uncovered bucket with a reason that closes the
  //     question, which is what this asserts.
  {
    const run = collect_sql_file_blocks(
      sql_file_entry(LEAGUE_DATABASE),
      () => `SELECT pid\nFROM ${placeholder('table_name')}\n`
    )
    cases.push([
      'gate 4 files a .sql statement whose placeholder sits inside an identifier as UNCOVERED, not dropped',
      run.statements.length === 0 &&
        run.uncovered.length === 1 &&
        /inside an identifier/.test(run.uncovered[0].reason)
    ])
  }

  // 19. An EXPLAIN that must fail, on a REAL extracted `.sql` corpus statement.
  //     Scoped to this extraction on purpose, exactly as case 14 is for `.raw()`:
  //     if no `.sql` root is supplied, or the extraction stops matching, there is
  //     nothing to mutate and this reports STAYED GREEN rather than passing over
  //     an unread tree. That is why gate 4 has no minimum-files constant either.
  if (db) {
    let reported = false
    let victim = null
    for (const statement of sql_file_statements) {
      try {
        await db.raw(`EXPLAIN ${statement.sql}`)
      } catch {
        continue
      }
      victim = statement
      const mutated = mutate_first_relation_reference(statement.sql)
      if (!mutated) continue
      try {
        await db.raw(`EXPLAIN ${mutated}`)
      } catch (error) {
        reported = error.code === '42P01'
      }
      break
    }
    cases.push([
      victim
        ? `gate 4 reports a corpus .sql statement pointed at a table that does not exist (${victim.path}:${victim.line})`
        : 'gate 4 reports a corpus .sql statement pointed at a table that does not exist -- NO .sql SQL IN CORPUS',
      reported
    ])
  }

  console.log('')
  console.log('NEGATIVE CONTROL')
  let ok = true
  for (const [label, passed] of cases) {
    console.log(`  ${passed ? 'RED as expected' : 'STAYED GREEN'}  ${label}`)
    if (!passed) ok = false
  }
  return ok
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

const parse_argv = () => {
  const argv = process.argv.slice(2)
  const options = { gates: [1, 2, 3, 4], roots: [], keep_database: false }
  for (let index = 0; index < argv.length; index++) {
    const flag = argv[index]
    if (flag === '--gate') options.gates = [Number(argv[++index])]
    else if (flag === '--root') options.roots.push(argv[++index])
    // A root whose `.sql` files belong to a database that is NOT league. Its
    // files are collected, counted and printed in the DATABASE-SCOPED bucket
    // rather than left outside the corpus, because a tree this gate silently
    // never read and one it read and cleared are the same line in a summary.
    else if (flag === '--database-root') {
      const database = argv[++index]
      options.roots.push({ path: argv[++index], database })
    }
    // A root contributing EXECUTABLE SQL only. See collect_corpus for the
    // measurement behind the restriction.
    else if (flag === '--executable-root')
      options.roots.push({
        path: argv[++index],
        extensions: new Set(['.sh', '.mjs', '.sql']),
        // `.mjs` is gate-3 only. See collect_corpus for the 52-false-positive
        // measurement that keeps JavaScript out of the prose derivation.
        prose_extensions: new Set(['.sh']),
        // Its `.sh` and `.mjs` bind themselves per statement, so there is nothing
        // for a bare `.sql` file under it to inherit -- UNRESOLVED, printed.
        database: null
      })
    else if (flag === '--keep-database') options.keep_database = true
    else {
      console.error(`unknown argument: ${flag}`)
      process.exit(2)
    }
  }
  options.roots = [...DEFAULT_ROOTS, ...options.roots]
  return options
}

const provision_database = async () => {
  const config = (await import('#config')).default
  const base_connection = {
    ...config.postgres.connection,
    host: process.env.LEAGUE_DB_HOST,
    port: Number(process.env.LEAGUE_DB_PORT)
  }
  const database = `league_docgate_${process.pid}_${Date.now()}`
  const admin = Knex({ client: 'pg', connection: base_connection })
  try {
    await admin.raw(`CREATE DATABASE ${database} OWNER ${base_connection.user}`)
  } catch (error) {
    console.error(
      'TOOLING ERROR: could not provision a gate database on ' +
        `${base_connection.host}:${base_connection.port} -- is \`yarn test:db:up\` running?\n` +
        error.message
    )
    return null
  } finally {
    await admin.destroy()
  }

  process.env.LEAGUE_DB_DATABASE = database
  const db = (await import('#db')).default
  await db.raw('CREATE EXTENSION IF NOT EXISTS pgcrypto')
  await db.raw(
    await fsp.readFile(path.join(repo_root, 'db/schema.postgres.sql'), 'utf8')
  )
  return { db, database, base_connection }
}

const main = async () => {
  const options = parse_argv()

  const schema_sql = fs.readFileSync(
    path.join(repo_root, 'db/schema.postgres.sql'),
    'utf8'
  )
  const { tables, views } = parse_schema(schema_sql)
  const { files: corpus, missing } = collect_corpus(options.roots)
  const adjudications = load_adjudications()

  console.log('LEAGUE SCHEMA CONSUMER GATE')
  console.log('')
  console.log('CORPUS')
  for (const entry of options.roots) {
    const root = typeof entry === 'string' ? entry : entry.path
    // Both halves of a root's declaration are printed: which extensions it
    // contributes, and which database its `.sql` files bind to. The second is
    // gate 4's whole oracle choice, so a reader must not have to infer it.
    const notes = []
    if (typeof entry !== 'string') {
      if (entry.extensions)
        notes.push(`${[...entry.extensions].join(', ')} only — executable SQL`)
      if (entry.database === null) notes.push('.sql binds no database')
      else if (entry.database && entry.database !== LEAGUE_DATABASE)
        notes.push(`.sql binds ${entry.database}`)
    }
    const restriction = notes.length ? `  (${notes.join('; ')})` : ''
    const count = corpus.filter((file) => file.root === root).length
    console.log(
      `  ${missing.includes(root) ? 'MISSING  ' : String(count).padStart(4)} ${missing.includes(root) ? '' : 'files  '}${root}${restriction}`
    )
  }
  if (missing.length) {
    console.log('')
    console.log(
      `TOOLING ERROR: ${missing.length} root(s) do not exist. A corpus root that ` +
        'silently resolves to nothing is a gate that reads green over an unread tree.'
    )
    process.exit(2)
  }

  const findings = []

  const gate_1 = run_gate_1({ corpus, tables, views, adjudications })
  if (options.gates.includes(1)) findings.push(...gate_1.findings)

  let provisioned = null
  let gate_2 = { findings: [], uncovered: [], explained: 0 }
  let gate_3 = { findings: [], uncovered: [], explained: 0 }
  let gate_4 = { findings: [], uncovered: [], explained: 0 }
  const blocks = collect_sql_blocks(corpus)
  const shell_blocks = collect_shell_sql_blocks(corpus)
  const api_blocks = collect_api_query_sql_blocks(corpus)
  const db_raw_blocks = collect_db_raw_sql_blocks(corpus)
  const sql_file_blocks = collect_sql_file_blocks(corpus)
  // All three gate-3 transports feed one oracle, so their league-bound statements
  // are one list from here on.
  const executable_statements = [
    ...shell_blocks.statements,
    ...api_blocks.statements,
    ...db_raw_blocks.statements
  ]
  const database_scoped = [
    ...shell_blocks.database_scoped,
    ...api_blocks.database_scoped,
    ...sql_file_blocks.database_scoped
  ]
  const unresolved = [
    ...shell_blocks.unresolved,
    ...db_raw_blocks.unresolved,
    ...sql_file_blocks.unresolved
  ]

  // Gates 2, 3 and 4 share one scratch database: same oracle, same schema, and
  // provisioning it more than once would multiply the only slow step in the run.
  const needs_database =
    options.gates.includes(2) ||
    options.gates.includes(3) ||
    options.gates.includes(4)
  if (needs_database) {
    provisioned = await provision_database()
    if (!provisioned) process.exit(2)
  }

  if (options.gates.includes(2)) {
    gate_2 = await explain_statements({
      db: provisioned.db,
      statements: blocks.statements,
      adjudications
    })
    findings.push(...gate_2.findings)
  }

  if (options.gates.includes(3)) {
    gate_3 = await explain_statements({
      db: provisioned.db,
      statements: executable_statements,
      adjudications,
      gate: 3
    })
    findings.push(...gate_3.findings)
  }

  if (options.gates.includes(4)) {
    gate_4 = await explain_statements({
      db: provisioned.db,
      statements: sql_file_blocks.statements,
      adjudications,
      gate: 4
    })
    findings.push(...gate_4.findings)
  }

  console.log('')
  console.log('COVERAGE (measured, not assumed)')
  console.log(`  files read                              ${corpus.length}`)
  console.log(
    `  schema tables / views parsed            ${tables.size} / ${views.size}`
  )
  console.log(
    `  gate 1: table.column pairs checked      ${gate_1.coverage.pairs_checked} (in ${gate_1.coverage.files_with_pairs} files)`
  )
  console.log(
    `  gate 1: skipped, table not a table      ${gate_1.coverage.pairs_skipped_unknown_table}`
  )
  console.log(
    `  gate 1: skipped, table is a VIEW        ${gate_1.coverage.pairs_skipped_view} — a view's columns are not in the dump`
  )
  console.log(
    `  gate 1: documented index columns checked ${gate_1.coverage.indexed_columns_checked}`
  )
  console.log(
    `  gate 1: index skipped, table not a table ${gate_1.coverage.indexed_columns_skipped_unknown_table}`
  )
  console.log(
    `  gate 1: files skipped, not prose        ${gate_1.coverage.files_skipped_not_prose} — .mjs (gate 3) and .sql (gate 4)`
  )
  console.log(
    `  gate 2: \`\`\`sql fences found              ${blocks.sql_fences}`
  )
  console.log(
    `  gate 2: statements EXPLAINed            ${options.gates.includes(2) ? gate_2.explained : 'not run'} of ${blocks.statements.length} extracted`
  )
  console.log(
    `  gate 3: shell scripts read              ${shell_blocks.coverage.shell_files}`
  )
  console.log(
    `  gate 3: SQL-bearing bash assignments    ${shell_blocks.coverage.assignments}` +
      `, psql -c ${shell_blocks.coverage.psql_inline}` +
      `, heredocs ${shell_blocks.coverage.heredocs_with_sql} of ${shell_blocks.coverage.heredocs_seen} seen`
  )
  console.log(
    `  gate 3: SQL-bearing scripts bound       ${shell_blocks.coverage.files_bound_to_league} league` +
      `, ${shell_blocks.coverage.files_database_scoped} other database` +
      `, ${shell_blocks.coverage.files_unresolved} unresolved`
  )
  console.log(
    `  gate 3: javascript files read           ${api_blocks.coverage.javascript_files}`
  )
  console.log(
    `  gate 3: /api/db/<database>/query sites  ${api_blocks.coverage.endpoints_seen}` +
      ` — ${api_blocks.coverage.endpoints_bound_to_league} league` +
      `, ${api_blocks.coverage.endpoints_database_scoped} other database` +
      `, ${api_blocks.coverage.sql_arguments_read} sql arguments read`
  )
  console.log(
    `  gate 3: in-repo .mjs read               ${db_raw_blocks.coverage.javascript_files}`
  )
  console.log(
    `  gate 3: .raw() sites                    ${db_raw_blocks.coverage.raw_call_sites}` +
      ` — ${db_raw_blocks.coverage.raw_literals_read} literal args read` +
      `, ${db_raw_blocks.coverage.module_constants_read} module SQL constants`
  )
  console.log(
    `  gate 3: .raw()-bearing files bound      ${db_raw_blocks.coverage.files_bound_to_league} league` +
      `, ${db_raw_blocks.coverage.files_unresolved} unresolved (no \`#db\` import)`
  )
  console.log(
    `  gate 3: statements EXPLAINed            ${options.gates.includes(3) ? gate_3.explained : 'not run'} of ${executable_statements.length} extracted`
  )
  console.log(
    `  gate 4: .sql files read                 ${sql_file_blocks.coverage.sql_files}` +
      ` — ${sql_file_blocks.coverage.files_bound_to_league} league` +
      `, ${sql_file_blocks.coverage.files_database_scoped} other database` +
      `, ${sql_file_blocks.coverage.files_unresolved} unresolved (root declares none)`
  )
  console.log(
    `  gate 4: statements EXPLAINed            ${options.gates.includes(4) ? gate_4.explained : 'not run'} of ${sql_file_blocks.statements.length} extracted` +
      `, from ${sql_file_blocks.coverage.statements_seen} split out of league-bound files`
  )
  const uncovered = [
    ...blocks.uncovered,
    ...gate_2.uncovered,
    ...shell_blocks.uncovered,
    ...api_blocks.uncovered,
    ...db_raw_blocks.uncovered,
    ...gate_3.uncovered,
    ...sql_file_blocks.uncovered,
    ...gate_4.uncovered
  ]
  console.log(
    `  gates 2+3+4: NOT checked                ${uncovered.length} — listed below`
  )
  console.log(
    `  gates 3+4: DATABASE-SCOPED              ${database_scoped.length} — not league, listed below`
  )
  console.log(
    `  gates 3+4: UNRESOLVED                   ${unresolved.length} — target not derivable, listed below`
  )

  if (uncovered.length) {
    console.log('')
    console.log(
      'GATES 2+3+4 NOT COVERED — these statements are NOT checked against any schema'
    )
    const by_reason = new Map()
    for (const entry of uncovered) {
      const key = entry.reason.replace(/\(.*\)/, '(...)')
      if (!by_reason.has(key)) by_reason.set(key, [])
      by_reason.get(key).push(entry)
    }
    for (const [reason, entries] of [...by_reason].sort(
      (a, b) => b[1].length - a[1].length
    )) {
      console.log(`  ${entries.length}  ${reason}`)
      for (const entry of entries)
        console.log(`       ${entry.path}:${entry.line}`)
    }
  }

  // Printed rather than counted, and printed even when empty. A statement whose
  // database this gate declined to judge and a statement it judged and cleared
  // are indistinguishable in a summary line, and only one of them is coverage.
  console.log('')
  console.log(
    'GATES 3+4 DATABASE-SCOPED — bound to a database that is NOT league, so this ' +
      "gate's schema is the wrong oracle and they are NOT checked"
  )
  if (!database_scoped.length) {
    console.log('  none')
  } else {
    const by_database = new Map()
    for (const entry of database_scoped) {
      if (!by_database.has(entry.database)) by_database.set(entry.database, [])
      by_database.get(entry.database).push(entry)
    }
    for (const [database, entries] of [...by_database].sort(
      (a, b) => b[1].length - a[1].length
    )) {
      console.log(`  ${entries.length}  ${database}`)
      for (const entry of entries)
        console.log(`       ${entry.path}:${entry.line}`)
    }
  }

  console.log('')
  console.log(
    'GATES 3+4 UNRESOLVED — the transport or root names a database target this gate cannot ' +
      'reduce to a literal, so they are NOT checked'
  )
  if (!unresolved.length) {
    console.log('  none')
  } else {
    const by_reason = new Map()
    for (const entry of unresolved) {
      if (!by_reason.has(entry.reason)) by_reason.set(entry.reason, [])
      by_reason.get(entry.reason).push(entry)
    }
    for (const [reason, entries] of [...by_reason].sort(
      (a, b) => b[1].length - a[1].length
    )) {
      console.log(`  ${entries.length}  ${reason}`)
      for (const entry of entries)
        console.log(`       ${entry.path}:${entry.line}`)
    }
  }

  // An adjudication that suppresses nothing is a finding, not a comment. This is
  // what stops the file drifting into the name denylist that blinded
  // `check-renamed-column-consumers`: an entry survives only as long as the site
  // it excuses still exists, so a repaired or deleted site forces the entry out
  // rather than leaving a standing exemption for a name.
  for (const entry of adjudications) {
    if (entry.used) continue
    if (!options.gates.includes(entry.gate)) continue
    findings.push({
      gate: entry.gate,
      kind: 'stale_adjudication',
      path: entry.path,
      line: 0,
      detail:
        `adjudication for ${entry.table ? `${entry.table}.${entry.column}` : `"${entry.statement_contains}"`} ` +
        'no longer suppresses anything — the site was repaired or moved, so remove the entry',
      context: entry.reason
    })
  }

  if (findings.length) {
    console.log('')
    console.log(`FINDINGS (${findings.length})`)
    for (const finding of findings.sort(
      (a, b) => a.gate - b.gate || a.path.localeCompare(b.path)
    )) {
      console.log(`  GATE ${finding.gate} ${finding.kind}`)
      console.log(`    ${finding.path}:${finding.line}`)
      console.log(`    ${finding.detail}`)
      if (finding.context) console.log(`    ${finding.context}`)
    }
  }

  const control_ok = await run_negative_control({
    corpus,
    tables,
    views,
    db: provisioned ? provisioned.db : null,
    statements: blocks.statements,
    shell_statements: executable_statements,
    db_raw_statements: db_raw_blocks.statements,
    sql_file_statements: sql_file_blocks.statements
  })

  if (provisioned) {
    await provisioned.db.destroy()
    if (options.keep_database) {
      console.log(`\nleft database ${provisioned.database} in place`)
    } else {
      const cleanup = Knex({
        client: 'pg',
        connection: provisioned.base_connection
      })
      try {
        await cleanup.raw(`DROP DATABASE IF EXISTS ${provisioned.database}`)
      } finally {
        await cleanup.destroy()
      }
    }
  }

  console.log('')
  if (!control_ok) {
    console.log(
      'GATE FAIL: the negative control did not go red. This gate cannot be trusted until it does.'
    )
    process.exit(1)
  }
  if (findings.length) {
    console.log(`GATE FAIL: ${findings.length} finding(s)`)
    process.exit(1)
  }
  console.log('GATE OK')
  process.exit(0)
}

main()
