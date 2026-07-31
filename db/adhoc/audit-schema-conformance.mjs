// Schema conformance audit for the league four-layer redesign.
//
// Parses db/schema.postgres.sql (the source of truth) and flags every column
// and table identifier that violates user:guideline/league/database-schema-standards.md.
// It is the ratcheting oracle the per-cluster migration recipe cites in its
// "conformance-audit clean" verify step: run it whole to see the standing debt,
// or scoped to one table/cluster to prove that cluster conforms.
//
// No database connection -- it reads the exported schema file only, so it runs
// anywhere and is safe to wire into the pre-publish gate.
//
// Usage:
//   node db/adhoc/audit-schema-conformance.mjs                 # whole schema
//   node db/adhoc/audit-schema-conformance.mjs --table player  # one table
//   node db/adhoc/audit-schema-conformance.mjs --summary       # counts only
//   node db/adhoc/audit-schema-conformance.mjs --json          # machine output
//
// Exit code is non-zero when any violation is found (gate-friendly).

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { parse_partition_children } from './schema-partitions.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const schema_path = path.join(__dirname, '..', 'schema.postgres.sql')

// --- rule inputs (ratcheting: extend these lists as new debt is discovered) ---

// Canonical keys and identifiers that are deliberately retained (operator
// decision) and MUST NOT be flagged even though they are short.
const allowlisted_identifiers = new Set([
  'pid',
  'esbid',
  'lid', // league id -- app key
  'tid', // team id -- app key
  'uid' // user id -- app key
])

// Reserved words used as identifiers (must be quoted in SQL, which is the tell).
//
// `position` and `timestamp` belong here, not in the camelCase rule. pg_dump
// quotes them because they are keywords, and the quoted_camelcase rule used to
// read that quoting as evidence of camelCase -- reporting ten lower snake_case
// names (`position` x6, `timestamp` x4) as "quoted/camelCase identifier
// (snake_case required)". They ARE reserved-word violations, but a worker acting
// on the camelCase label would look for a case change that does not exist.
const reserved_word_columns = new Set([
  'desc',
  'int',
  'to',
  'order',
  'end',
  'default',
  'primary',
  'offset',
  'from',
  'select',
  'user',
  'check',
  'position',
  'timestamp'
])

// Known fantasy-stat / role shorthand that must be spelled in full words.
// Value is the intended full-word replacement (for the report only).
const shorthand_columns = new Map([
  ['py', 'passing_yards'],
  ['ry', 'rushing_yards'],
  ['recy', 'receiving_yards'],
  ['pa', 'pass_attempts'],
  ['pc', 'pass_completions'],
  ['ra', 'rush_attempts'],
  ['rec', 'receptions'],
  ['trg', 'targets'],
  ['tdp', 'passing_touchdowns'],
  ['tdr', 'rushing_touchdowns'],
  ['tdrec', 'receiving_touchdowns'],
  ['fuml', 'fumbles_lost'],
  ['twoptc', 'two_point_conversions'],
  ['snp', 'snaps'],
  ['tm', 'nfl_team'],
  ['opp', 'opponent_nfl_team'],
  ['off', 'offense_nfl_team'],
  ['def', 'defense_nfl_team'],
  ['pos_team', 'team_nfl_team'],
  ['bc_pid', 'ball_carrier_pid'],
  ['psr_pid', 'passer_pid'],
  ['trg_pid', 'target_pid'],
  ['intp_pid', 'interceptor_pid'],
  ['pos', 'position'],
  // Every other temporal feed here names its observation instant `observed_at`
  // (espn win rates, espn receiving metrics, the projection-value history), and
  // this one retypes to timestamptz under the timestamp rule, so `observed_at`
  // is the conforming name rather than a date-flavoured variant.
  ['d', 'observed_at']
])

// Replacement hints for columns whose right name depends on the TABLE, not just
// the spelling. Keyed table.column and consulted before the map above, so a bare
// name that means one thing here and another elsewhere is not given one global
// answer -- the mistake that put `keeptradecut_rankings.v` under the team rule
// in the first place.
const column_specific_shorthand = new Map([
  // NOT `value`: the column is polymorphic on the sibling `type` column, and
  // 3.28M of its 5.63M rows hold a RANK, not a value (type 2 POSITION_RANK
  // ranges 1-421, type 3 OVERALL_RANK ranges 1-1574, against type 1 VALUE at
  // -2..9999). A name asserting "value" would be wrong for 58% of the table --
  // the same class of error as the ambiguous_team false positive this rule
  // replaced, pointing the other way. `metric_value` is what it holds: the value
  // of whichever metric `type` names.
  ['keeptradecut_rankings.v', 'metric_value']
])

// The shorthand rule above is an ENUMERATION, and an enumeration of already-known
// names can only ever report the debt it can name. It listed 25 fantasy-stat
// abbreviations, every one of them already migrated, and so reported 0 shorthand
// schema-wide while `pos` sat on 10 logical tables and `avsk`/`cpoe`/`yfog`/`oopd`
// sat on nfl_plays. That is the failure mode the standards guideline names: "a
// gate whose rules are enumerations reports the debt it can name, never the debt."
//
// So the rule is INVERTED below. The default for a bare short column name is
// FLAG, and this closed list is the set of legitimate short English words that
// are exempt. New shorthand introduced by a future migration is caught with no
// edit to this file, which is the ratchet property the enumeration lacked.
//
// Scope is deliberately narrow: a BARE name (no underscore) of five characters
// or fewer. A token-level rule was measured and is unusable -- 1991 of 2595
// distinct column names contain some token of four characters or fewer, because
// legitimate compounds (`is_home`, `pass_yards`, `player_id`) are built from
// short tokens. The bare short name is the actual hazard the standard names:
// "A name SHOULD be specific enough to be globally unique across the schema so
// that a grep for it returns exactly its real uses."
//
// Membership test: a bare name is exempt only if it names a STRUCTURAL attribute
// or identifier -- a category, a key, a label, an ordinal position. A bare name
// that denotes a QUANTITY (count, rate, score, rank, measurement) is flagged,
// because a quantity is the thing that needs a qualifier to say what it counts
// and in what unit. That is the standard's own rule, generalised from its two
// worked examples: "not a bare `snaps` repeated with different meanings;
// `passing_yards` not `yards`".
//
// An earlier version of this list described its test as "is this a real word"
// and did not apply it: `snaps` was flagged and `yards` exempted, though the
// standard names both. It also exempted names the schema itself proves are
// ambiguous -- `value` is integer on one table and jsonb on another, `pass` is
// boolean on 29 tables and numeric on a thirtieth, `route` is an enum on 29 and
// varchar on a thirtieth. Differing types under one name is the schema stating
// outright that the name carries more than one meaning.
//
// Domain acronyms (`adp`, `faab`, `epa`, `cpoe`) are likewise not exempt -- they
// are exactly the shorthand the standard prohibits.
//
// Some names this rule flags are bare BOOLEANS (`blitz`, `hurry`, `spike`,
// `stunt`, `open`, `start`), whose more precise defect is the standard's
// "prefixed is_/has_ for predicates" rule -- which this audit does not yet
// implement at all. There are 300 such columns across 179 distinct names on the
// logical tables. They are genuinely non-conforming either way and the remedy is
// the same rename (`score` -> `is_scoring_play`), so flagging them here surfaces
// them rather than losing them; when the boolean rule lands they reclassify to
// it, exactly as `position` and `timestamp` moved off the camelCase rule.
const accepted_short_words = new Set([
  'batch',
  'class',
  'code',
  'date',
  'day',
  'email',
  'facet',
  'field',
  'id',
  'image',
  'index',
  'key',
  'name',
  'notes',
  'pick',
  'roof',
  'round',
  'size',
  'slot',
  'slug',
  'sport',
  'state',
  'tag',
  'type',
  'unit',
  'url',
  'week'
])

// A bare name of five characters or fewer that is not a recognised word, not a
// canonical app key, and not already covered by a more specific rule.
function is_bare_shorthand(name) {
  if (name.includes('_')) return false
  if (name.length > 5) return false
  if (accepted_short_words.has(name)) return false
  if (allowlisted_identifiers.has(name)) return false
  // `year` is the season-grain rule's business; reserved words their own rule's.
  // The ambiguous-team names are handled by the caller, which knows whether the
  // team rule actually claimed this column (see non_team_columns).
  if (season_grain_columns.has(name)) return false
  if (reserved_word_columns.has(name)) return false
  return true
}

// Season-grain naming: the standard is `season_year` + `season_type`, so a bare
// `year` column and the abbreviated `seas_type` both violate it. Exact-name
// match so `season_year`/`draft_year`/`season_type` never flag. Value is the
// intended full replacement (report only). These drive the coordinated
// season_year sweep across the remaining time-series and league tables.
const season_grain_columns = new Map([
  ['year', 'season_year'],
  ['seas_type', 'season_type']
])

// Bare single-letter / ambiguous team-role spellings (checked as exact names).
const ambiguous_team_columns = new Set(['v', 'h', 'team', 'club', 'clubcode'])

// The team-role rule matches on NAME alone, and `v`/`h` are only team spellings
// when the column actually holds a team. Keyed table.column, these are columns
// whose name collides with that list but whose MEANING is something else, so the
// team rule must not claim them.
//
// This is not a suppression: the column is still non-conforming and is still
// reported, under the rule that actually describes it (`v` is shorthand for a
// value, so the bare-short-name rule takes it). Suppressing it would hide real
// debt; leaving it under ambiguous_team would tell a worker to rename a value
// column to a team name, which corrupts the meaning of the data rather than the
// spelling of it. keeptradecut_rankings.v is written by scripts/import-keeptradecut.mjs
// as `v: i.v` under `type: keeptradecut_metric_types.VALUE` / `.OVERALL_RANK` /
// `.POSITION_RANK` -- a KeepTradeCut player value, never a visiting team.
const non_team_columns = new Set(['keeptradecut_rankings.v'])

// Source-system name fragments, used ONLY to recognise an id column as pointing
// at an external system rather than at an internal app key (see
// looks_like_external). This audit does NOT flag these names as violations.
//
// Source obfuscation was dialled back by operator ruling (2026-07-22 ruling 1,
// 2026-07-23 NGS ruling, reaffirmed 2026-07-28): it is OFF BY DEFAULT and applies
// only to select play-by-play / charted source data, per identifier, with prior
// operator approval. Obfuscating a vendor whose identity is self-evident from the
// data is theater. `pff_*` and `ngs_*` names therefore STAY, and a blanket
// vendor-token rule was removed from this audit — a completion gate must only
// flag genuine defects, and 30 of its findings were names the operator had
// already ruled to keep. Candidate surfacing lives in the advisory
// db/adhoc/scan-source-leakage.mjs, which is deliberately not a gate.
const external_system_tokens = ['pff', 'ngs', 'nfl_pro', 'nflpro']

// Operator-ratified metric columns whose name legitimately ends in a word that
// collides with the timestamp `_at` heuristic. These are SIS run-direction
// metrics ("bounce/position percentage when run at [the gap]") -- numeric
// percentages, not timestamps. Keyed table.column so the exemption is narrow.
const accepted_non_timestamp_columns = new Set([
  'player_college_careerlogs.bounce_pct_when_run_at',
  'player_college_careerlogs.pos_pct_when_run_at',
  'player_college_seasonlogs.bounce_pct_when_run_at',
  'player_college_seasonlogs.pos_pct_when_run_at',
  // Numeric DURATIONS, not instants: seconds elapsed within a play. The name
  // rule matches the _time suffix, but there is no instant to make tz-aware.
  // Operator-ruled keeps (2026-07-24, nfl-plays-snaps cluster) -- recorded here
  // so a later audit reads them as settled rather than as unfinished retypes.
  'nfl_plays.punt_hang_time',
  'nfl_plays.pocket_time',
  'nfl_plays_passer.air_time'
])

// External-id columns that end in _id but do not follow {system}_{entitytype}_id.
// Detected by pattern; this set is the known non-conforming roster for messaging.
const known_bad_external_ids = new Set([
  'gsisid',
  'gsis_it_id',
  'esb_id',
  'pff_id',
  'sleeper_id',
  'espn_id',
  'sportradar_id',
  'yahoo_id',
  'rotoworld_id',
  'rotowire_id',
  'cbs_id',
  'cfbref_id',
  'sis_id',
  'pfr_id',
  'keeptradecut_id',
  'fantasypros_id'
])

// --- schema parsing ----------------------------------------------------------

// Extract { table -> [{ name, quoted, type }] } from CREATE TABLE blocks.
// Partition children (CREATE TABLE ... PARTITION OF ...) carry no column list
// and are skipped; their parent carries the columns.
function parse_schema(sql) {
  const tables = new Map()
  const lines = sql.split('\n')
  let current = null
  let columns = null

  const create_re = /^CREATE TABLE (?:public\.)?("?[A-Za-z0-9_]+"?)\s*\(\s*$/

  for (const raw of lines) {
    if (current === null) {
      const m = raw.match(create_re)
      if (m) {
        current = m[1].replace(/"/g, '')
        columns = []
      }
      continue
    }

    // End of the block.
    if (/^\);/.test(raw.trim()) || raw.trim() === ')') {
      tables.set(current, columns)
      current = null
      columns = null
      continue
    }

    const col = parse_column_line(raw)
    if (col) columns.push(col)
  }

  return tables
}

// A column line looks like: `    "playId" integer NOT NULL,`
// Skip table-level constraint lines.
function parse_column_line(raw) {
  const trimmed = raw.trim().replace(/,$/, '')
  if (!trimmed) return null

  const constraint_kw =
    /^(CONSTRAINT|PRIMARY KEY|FOREIGN KEY|UNIQUE|CHECK|EXCLUDE|PARTITION|LIKE)\b/i
  if (constraint_kw.test(trimmed)) return null

  const quoted = trimmed.match(/^"([^"]+)"\s+(.*)$/)
  if (quoted) {
    return { name: quoted[1], quoted: true, type: quoted[2] }
  }

  const bare = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s+(.*)$/)
  if (bare) {
    return { name: bare[1], quoted: false, type: bare[2] }
  }

  return null
}

// --- rule checks -------------------------------------------------------------

const RULES = {
  quoted_camelcase: 'Quoted/camelCase identifier (snake_case required)',
  reserved_word: 'Reserved word used as identifier',
  shorthand: 'Domain shorthand (full words required)',
  season_grain:
    'Non-conforming season grain (season_year/season_type required)',
  ambiguous_team: 'Ambiguous team-role spelling (qualify explicitly)',
  external_id: 'External-id column not following {system}_{entitytype}_id',
  timestamp_type: 'Non-timestamptz timestamp representation'
}

// Known instants whose NAME carries no time suffix, so the pattern below cannot
// see them. Keyed table.column. Both keeptradecut columns are integer epochs --
// prohibited representations that the suffix rule reported as clean because the
// name is a single letter.
const known_time_columns = new Set([
  'keeptradecut_rankings.d',
  'keeptradecut_liquidity.d'
])

function looks_like_time_column(table, name) {
  if (known_time_columns.has(`${table}.${name}`)) return true
  return /(_at|_time|_ts|timestamp|_date)$/.test(name) || name === 'timestamp'
}

function check_column(table, col) {
  const findings = []
  const lower = col.name.toLowerCase()

  if (allowlisted_identifiers.has(lower)) {
    // canonical retained key -- only the time check below still applies, and no
    // allowlisted key matches it, so return clean.
    return findings
  }

  // Quoted / camelCase. Tested on the NAME, not on whether pg_dump quoted it:
  // the dump also quotes lower snake_case keywords, and reading that quoting as
  // camelCase mislabelled `position` and `timestamp` (see reserved_word_columns).
  if (/[A-Z]/.test(col.name)) {
    findings.push({ rule: 'quoted_camelcase', table, column: col.name })
  }

  // Reserved words (they are quoted in the dump, but flag by name too).
  if (reserved_word_columns.has(lower)) {
    findings.push({ rule: 'reserved_word', table, column: col.name })
  }

  // Ambiguous team-role bare names, unless this column only shares the spelling
  // and means something else entirely.
  const is_team_column =
    ambiguous_team_columns.has(lower) &&
    !non_team_columns.has(`${table}.${lower}`)
  if (is_team_column) {
    findings.push({ rule: 'ambiguous_team', table, column: col.name })
  }

  // Shorthand: the table-specific hint first, then the named-abbreviation map,
  // then the general bare-short-name rule for everything neither can name.
  const specific_hint = column_specific_shorthand.get(`${table}.${lower}`)
  if (specific_hint) {
    findings.push({
      rule: 'shorthand',
      table,
      column: col.name,
      hint: specific_hint
    })
  } else if (shorthand_columns.has(lower)) {
    findings.push({
      rule: 'shorthand',
      table,
      column: col.name,
      hint: shorthand_columns.get(lower)
    })
  } else if (!is_team_column && is_bare_shorthand(lower)) {
    findings.push({ rule: 'shorthand', table, column: col.name })
  }

  // Season grain (bare `year` / abbreviated `seas_type`).
  if (season_grain_columns.has(lower)) {
    findings.push({
      rule: 'season_grain',
      table,
      column: col.name,
      hint: season_grain_columns.get(lower)
    })
  }

  // External id naming: ends in _id (or is a known id) but is not {a}_{b}_id.
  const is_id_column =
    /_?id$/.test(lower) && !allowlisted_identifiers.has(lower)
  // {system}_{entitytype}_id, where {system} may be multi-token (gsis_it,
  // fantasy_data) so gsis_it_player_id / fantasy_data_player_id conform; plus the
  // two-token form and the {role}_pid form. `league` is an entitytype so the
  // external-league keys conform once renamed (leagues.espn_id -> espn_league_id,
  // .sleeper_id -> sleeper_league_id).
  const conforms_external =
    /^[a-z0-9]+(_[a-z0-9]+)*_(player|team|game|league|site)_id$/.test(lower) ||
    /^[a-z0-9]+_[a-z0-9]+_id$/.test(lower) ||
    /_pid$/.test(lower)
  if (
    (known_bad_external_ids.has(lower) ||
      (is_id_column && !conforms_external && looks_like_external(lower))) &&
    !conforms_external
  ) {
    findings.push({ rule: 'external_id', table, column: col.name })
  }

  // Timestamp representation.
  const type = col.type.toLowerCase()
  if (looks_like_time_column(table, lower)) {
    const is_tztimestamp = /timestamp with time zone|timestamptz/.test(type)
    const is_epoch_int = /^(integer|bigint|numeric)/.test(type)
    const is_varchar = /character varying|text/.test(type)
    const is_plain_timestamp =
      /timestamp without time zone/.test(type) ||
      (/^timestamp\b/.test(type) && !is_tztimestamp)
    if (
      (is_epoch_int || is_varchar || is_plain_timestamp) &&
      !accepted_non_timestamp_columns.has(`${table}.${lower}`)
    ) {
      findings.push({
        rule: 'timestamp_type',
        table,
        column: col.name,
        detail: col.type.trim()
      })
    }
  }

  return findings
}

// Heuristic: an id column referencing an external system rather than an internal
// app key.
//
// The vendor vocabulary below is matched two ways: as a separated segment
// (`pff_id`, `home_ngs_team_id`) and as a GLUED prefix with no separator
// (`espnid`, `pfrid`, `ngsid`, `home_ngsid`). The glued form is the one this rule
// used to miss. Its predecessor tested `/^(gsis|sleeper|yahoo|roto|cbs|shield|
// nfl)_?/`, a short hardcoded list that happened to catch `gsisid` and `shieldid`
// and missed `espnid`, `pfrid`, `ngsid`, `detailid_*` and the three `*_ngsid`
// columns -- 8 of the 10 no-separator vendor ids on nfl_games, every one of them
// real debt the gate reported as clean.
//
// Deliberately NOT a pure shape rule. "an id column with no separator before the
// id" sounds recurrence-proof and is not usable here: the schema is full of
// internal keys and ordinary words with that shape (`bid`, `min_bid`,
// `cash_paid`, `salary_paid`, `aid`, `hid`, `rid`, `commishid`, `pickid`,
// `poachid`), and flagging them would fill the gate with non-defects -- the
// failure operation-log 004 records for the vendor_leak rule. Distinguishing
// `espnid` from `poachid` requires knowing that espn is a vendor and poach is a
// domain verb, so a vocabulary is the honest mechanism. Keeping it in one place,
// used by both match shapes, is what stops the class recurring: adding a vendor
// here covers every spelling of it at once.
const external_vendor_tokens = [
  ...external_system_tokens,
  'gsis',
  'espn',
  'pfr',
  'sleeper',
  'yahoo',
  'roto',
  'rotoworld',
  'rotowire',
  'cbs',
  'shield',
  'nfl',
  'nflverse',
  'sportradar',
  'sis',
  'cfbref',
  'keeptradecut',
  'fantasypros',
  'fantasy_data',
  'detail',
  'ftn',
  'otc',
  'mfl',
  'ffpc',
  'nffc',
  'fantrax',
  'fleaflicker',
  'rtsports',
  'draftkings',
  'fanduel',
  'betmgm',
  'caesars',
  'pinnacle',
  'prizepicks',
  'betonline',
  'betrivers',
  'fanatics',
  'gambet'
]

function looks_like_external(name) {
  if (external_vendor_tokens.some((t) => name_has_token(name, t))) return true
  // Glued form: vendor token running straight into the rest of the name, either
  // at the start (`espnid`) or after a separator (`home_ngsid`, `site_ngsid`).
  return external_vendor_tokens.some((t) =>
    new RegExp(`(^|_)${t}[a-z0-9]`).test(name)
  )
}

// Token appears as a word-boundary segment in a snake/qualified name, so `pff`
// matches pff_id / nfl_pff / x_pff_y but not e.g. `spffx` accidental substrings.
function name_has_token(name, token) {
  return new RegExp(`(^|_)${token}(_|$)`).test(name)
}

function check_table_name(table) {
  const findings = []
  if (/[A-Z]/.test(table)) {
    findings.push({ rule: 'quoted_camelcase', table, column: null })
  }
  return findings
}

// --- runner ------------------------------------------------------------------

// Partition children duplicate their parent's whole column list in the dump, so
// auditing them would count the same violation once per partition. They are
// skipped -- the parent carries the columns and is audited once. Membership is
// derived from the dump's ATTACH PARTITION lines by db/adhoc/schema-partitions.mjs;
// see that file for why the previous `<base>_year_YYYY` regex was wrong.

function audit(tables, partition_children, filter) {
  const all = []
  for (const [table, columns] of tables) {
    if (filter && table !== filter) continue
    if (!filter && partition_children.has(table)) continue
    all.push(...check_table_name(table))
    for (const col of columns) {
      all.push(...check_column(table, col))
    }
  }
  return all
}

function main() {
  const argv = yargs(hideBin(process.argv))
    .option('table', { type: 'string', description: 'Audit one table only' })
    .option('summary', { type: 'boolean', default: false })
    .option('json', { type: 'boolean', default: false })
    .help().argv

  const sql = fs.readFileSync(schema_path, 'utf8')
  const tables = parse_schema(sql)
  const partition_children = parse_partition_children(sql)
  const findings = audit(tables, partition_children, argv.table)
  const logical_table_count = tables.size - partition_children.size

  // Set exitCode rather than calling process.exit(): a large JSON payload is
  // still buffering when process.exit() would fire, and the abrupt exit
  // truncates stdout mid-write. exitCode lets the write drain naturally.
  if (argv.json) {
    console.log(
      JSON.stringify(
        {
          tables: logical_table_count,
          partition_children: partition_children.size,
          findings
        },
        null,
        2
      )
    )
    process.exitCode = findings.length ? 1 : 0
    return
  }

  const by_rule = new Map()
  for (const f of findings) {
    by_rule.set(f.rule, (by_rule.get(f.rule) || 0) + 1)
  }

  console.log(
    `schema conformance audit -- ${logical_table_count} logical tables (${partition_children.size} partition children skipped)${argv.table ? ` (filtered to ${argv.table})` : ''}`
  )
  console.log(`total violations: ${findings.length}`)
  console.log('')
  for (const rule of Object.keys(RULES)) {
    console.log(
      `  ${String(by_rule.get(rule) || 0).padStart(5)}  ${rule} -- ${RULES[rule]}`
    )
  }

  if (!argv.summary && findings.length) {
    console.log('\n--- detail ---')
    for (const f of findings) {
      const loc = f.column ? `${f.table}.${f.column}` : `${f.table} (table)`
      const extra = f.hint
        ? ` -> ${f.hint}`
        : f.detail
          ? ` [${f.detail}]`
          : f.token
            ? ` [${f.token}]`
            : ''
      console.log(`  [${f.rule}] ${loc}${extra}`)
    }
  }

  process.exitCode = findings.length ? 1 : 0
}

main()
