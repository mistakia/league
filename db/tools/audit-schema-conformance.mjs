// Schema conformance audit for the league four-layer redesign.
//
// Parses db/schema.postgres.sql (the source of truth) and flags every column
// and table identifier that violates user:guideline/nfl/league/database-schema-standards.md.
// It is the ratcheting oracle the per-cluster migration recipe cites in its
// "conformance-audit clean" verify step: run it whole to see the standing debt,
// or scoped to one table/cluster to prove that cluster conforms.
//
// No database connection -- it reads the exported schema file only, so it runs
// anywhere and is safe to wire into the pre-publish gate.
//
// Usage:
//   node db/tools/audit-schema-conformance.mjs                 # whole schema
//   node db/tools/audit-schema-conformance.mjs --table player  # one table
//   node db/tools/audit-schema-conformance.mjs --summary       # counts only
//   node db/tools/audit-schema-conformance.mjs --json          # machine output
//
// Exit code is non-zero when any violation is found (gate-friendly).

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { parse_partition_children } from './schema-partitions.mjs'
import {
  nonconforming_tokens,
  is_vocabulary_token
} from './schema-token-vocabulary.mjs'

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
// answer -- the mistake that once put `keeptradecut_rankings.v` under the team
// rule, before that table was restructured into keeptradecut_valuations and the
// polymorphic column ceased to exist. Empty is the correct state: an entry here
// describes live debt, so a gate that kept naming a removed column could never
// reach zero.
const column_specific_shorthand = new Map([])

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
// or fewer. A LENGTH-based token rule was measured and is unusable -- 1991 of
// 2595 distinct column names contain some token of four characters or fewer,
// because legitimate compounds (`is_home`, `pass_yards`, `player_id`) are built
// from short tokens. The bare short name is the actual hazard the standard names:
// "A name SHOULD be specific enough to be globally unique across the schema so
// that a grep for it returns exactly its real uses."
//
// That measurement is about LENGTH, and reading it as a verdict on token-level
// rules in general is what left the interior-token gap open for as long as it
// was. A token rule keyed on VOCABULARY rather than on length is both usable and
// necessary, and it lives in the `vocabulary_shorthand` branch below; this rule
// keeps the bare name, which the vocabulary rule deliberately does not judge.
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
// Domain acronyms (`adp`, `faab`, `cpoe`) are likewise not exempt -- they are
// exactly the shorthand the standard prohibits, and each has an unambiguous
// expansion (average_draft_position, faab_budget,
// completion_percentage_over_expected). The narrow exception is
// `proprietary_metric_names` below.
//
// Some names this rule used to flag are bare BOOLEANS (`blitz`, `hurry`,
// `spike`, `stunt`, `open`, `start`), whose more precise defect is the standard's
// "prefixed is_/has_ for predicates" rule. That rule now exists (see
// is_unprefixed_boolean below) and OWNS them: 40 columns across 21 names
// reclassified off this rule onto boolean_prefix when it landed, exactly as
// `position` and `timestamp` moved off the camelCase rule. They were never
// double-reported and are not lost -- the remedy is the same rename
// (`score` -> `is_scoring_play`), now filed under the rule that describes it.
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

// Proprietary metric names retained by operator ruling. These are NOT
// abbreviations of an English phrase we are declining to spell out -- they are
// the published names of third-party metrics, and expanding them would name the
// column something the vendor's own documentation does not use.
//
// The ruling is db/adhoc/2026-07-22-player-prospect-profile-sis-conform.sql:5,
// which conformed 224 SIS columns and recorded "IQR kept (proprietary metric
// name, like EPA)". Both were verified against production before being exempted
// here rather than taken on the ruling alone:
//
//   epa -- Expected Points Added, the standard play-value metric. Already spelt
//     out in docs/glossary.md:426, and carried schema-wide as `*_epa` compounds
//     (pass_epa, rush_epa) that this rule never flagged because they contain an
//     underscore. Flagging the bare form alone was inconsistent with that.
//   iqr -- Sports Info Solutions' Independent Quarterback Rating, NOT the
//     statistical interquartile range. Confirmed by scale: iqr_deep and
//     iqr_pressure top out at exactly 158.3, the NFL passer-rating maximum, and
//     the column is populated only for quarterbacks.
//
// Deliberately narrow. `adp`, `faab` and `cpoe` stay flagged -- each expands to
// an ordinary English phrase, so the standard applies to them unchanged.
const proprietary_metric_names = new Set(['epa', 'iqr'])

// A bare name that is not a recognised word, not a canonical app key, and not
// already covered by a more specific rule.
function is_bare_shorthand(name) {
  if (name.includes('_')) return false
  if (accepted_short_words.has(name)) return false
  if (proprietary_metric_names.has(name)) return false
  if (allowlisted_identifiers.has(name)) return false
  // `year` is the season-grain rule's business; reserved words their own rule's.
  // The ambiguous-team names are handled by the caller, which knows whether the
  // team rule actually claimed this column (see non_team_columns).
  if (season_grain_columns.has(name)) return false
  if (reserved_word_columns.has(name)) return false
  // A name of five characters or fewer is governed by the closed lists above,
  // which is this rule's historical scope. A LONGER bare name was previously
  // unreachable by any branch -- the length cap returned here and the
  // interior-token branch requiring an underscore -- so the glued app keys
  // (`userid`, `tradeid`, `commishid`) and compound shorthand (`tddate`,
  // `vbaseline`, `srbwrte`) were invisible to the audit. Judge them against the
  // same positive vocabulary as interior tokens: `username`, `password` and the
  // compound English words the schema legitimately spells stay clean because
  // they are members, and a glued key that is not a word flags.
  if (name.length > 5) return !is_vocabulary_token(name)
  return true
}

// Boolean predicate naming: "Boolean columns MUST be SQL `boolean`, prefixed
// `is_` / `has_` for predicates."
//
// This rule is TYPE-DRIVEN, not name-driven, which is what makes it a real
// ratchet rather than another enumeration: it reads the declared type out of the
// dump, so a boolean added by a future migration under any name at all is caught
// with no edit to this file. It is the counterpart to the inverted bare-short-name
// rule above -- both replace a list of names someone thought of with a property
// the schema states about itself.
//
// The carve-out is SHAPE, not identity. A name carrying `_is_` / `_has_` in the
// middle is a qualified predicate -- a subject followed by the predicate marker,
// as in `combine_height_is_pro_day` or `forty_yd_dash_is_unofficial`. Those read
// correctly, are unambiguously boolean at a glance, and the prefixed rewrite
// (`is_combine_height_pro_day`) is strictly worse English: it detaches the
// predicate from the measurement it qualifies. 50 columns across 30 names take
// this form, all of them combine/pro-day measurement flags. Exempting the SHAPE
// rather than listing the 30 names keeps the rule recurrence-proof -- a new
// measurement flag conforms on arrival instead of needing an allowlist entry.
//
// TEXT booleans ("Y"/"N" varchar columns) are prohibited by the same sentence of
// the standard and are NOT covered here: nothing in the dump distinguishes a
// varchar flag from any other varchar, so detecting them needs value sampling
// against production rather than a schema parse. That is a separate instrument,
// not a widening of this one.
function is_unprefixed_boolean(col) {
  if (!/^boolean\b/.test(col.type.trim().toLowerCase())) return false
  const name = col.name.toLowerCase()
  if (/^(is|has)_/.test(name)) return false
  if (/_(is|has)_/.test(name)) return false
  return true
}

// The is_qb_* charting booleans are ratified by SHAPE rather than by token
// (operator ruling 2026-08-15). "QB hit", "QB pressure", "QB scramble" etc. are
// the published charting stat names -- the closed-list test is whether the
// ABBREVIATION is the term in actual use, and `qb` is. Ratifying the token `qb`
// in the vocabulary instead would also have stopped the gate flagging the
// league-format and settings class this plan most wanted it to hold --
// `starter_slots_qb`, `max_roster_qb` and their siblings, since conformed to
// `starter_slots_quarterback` and `max_roster_quarterback` by the 2026-08-16
// position-code batch. The class is what the shape carve-out protects, not
// those particular names. So the exemption is the shape -- a BOOLEAN named
// is_qb_<event> --
// which keeps the ruling narrow and lets a charting boolean added later conform
// on arrival, the same reasoning as the `_is_`/`_has_` qualified-predicate
// exemption above. A non-boolean is_qb_* column is NOT exempt: the is_ prefix
// promises boolean semantics, so a column failing that promise stays flagged on
// its `qb` token.
function is_qb_charting_boolean(col) {
  if (!/^boolean\b/.test(col.type.trim().toLowerCase())) return false
  return /^is_qb_[a-z0-9_]+$/.test(col.name.toLowerCase())
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
// An entry here is not a suppression: the column is still non-conforming and is
// still reported, under the rule that actually describes it. Suppressing it
// would hide real debt; leaving a value column under ambiguous_team would tell a
// worker to rename it to a team name, corrupting the meaning of the data rather
// than the spelling of it. The sole entry was keeptradecut_rankings.v, removed
// when that table was restructured into keeptradecut_valuations and its
// polymorphic value column was replaced by three named ones.
const non_team_columns = new Set([])

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
// db/tools/scan-source-leakage.mjs, which is deliberately not a gate.
const external_system_tokens = ['pff', 'ngs', 'nfl_pro', 'nflpro']

// Operator-ratified metric columns whose name legitimately ends in a word that
// collides with the timestamp `_at` heuristic. These are SIS run-direction
// metrics ("bounce/position percentage when run at [the gap]") -- numeric
// percentages, not timestamps. Keyed table.column so the exemption is narrow.
const accepted_non_timestamp_columns = new Set([
  'player_college_careerlogs.bounce_percentage_when_run_at',
  'player_college_careerlogs.positive_percentage_when_run_at',
  'player_college_seasonlogs.bounce_percentage_when_run_at',
  'player_college_seasonlogs.positive_percentage_when_run_at',
  // Numeric DURATIONS, not instants: seconds elapsed within a play. The name
  // rule matches the _time suffix, but there is no instant to make tz-aware.
  // Operator-ruled keeps (2026-07-24, nfl-plays-snaps cluster) -- recorded here
  // so a later audit reads them as settled rather than as unfinished retypes.
  'nfl_plays.punt_hang_time',
  'nfl_plays.pocket_time',
  'nfl_plays_passer.air_time'
])

// Columns on which a NAMED token is accepted, keyed `table.column` and scoped to
// the specific token so the rest of the column still reports. Precedented by
// `accepted_non_timestamp_columns`, so the exemption cannot widen silently --
// and validated in main() so an entry naming a column the schema does not have,
// or naming a token that column does not carry, fails the run rather than
// sitting stale.
//
// Scoping to the TOKEN rather than the column is what makes this usable on a
// column carrying more than one kind of debt. `nfl_team_gamelogs.def_avg_get_off`
// is a `get_off` column AND an `avg` column: accepting the whole column would
// silently retire an `avg` finding the counting-stat batch owns, which is the
// hide-real-debt failure `non_team_columns` states as its own reason.
//
// Two rulings live here.
//
// ROLE-PID (`qb`), operator ruling 2026-08-15. The `{role}_pid` pattern is
// already conformed schema-wide (`ball_carrier_pid`, `passer_pid`, `target_pid`,
// `interceptor_pid`, the tackle-attribution family), and `qb` in these three is
// the ROLE rather than shorthand, so the interior-token rule flagging them
// contradicts an existing settled ruling.
//
// ORDINARY-WORD `off`, settled 2026-08-16 on the side-prefix batch. `off` is
// ruled EXPAND -> `offense`, and on four columns the token is not the side of
// the ball at all but the ordinary English word, inside a published two-word
// term. `get_off` is the NGS metric (`gamelog.go` / `prGo`, the time from snap
// to a pass rusher's first movement) and `off_man` is the SIS coverage call
// ("Off-Man", a defensive back aligned off the receiver). A uniform token rename
// writes `player_get_offense` and `positional_factor_offense_man_coverage`,
// which mis-documents the columns rather than conforming them. Same reasoning as
// the `mid_zone` KEEP and the `pass_epa_per_dropback` sense split: the audit's token
// view cannot see a sense, so the sense is settled here.
const accepted_column_tokens = new Map([
  ['nfl_plays.qb_pid', new Set(['qb'])],
  ['nfl_games.away_qb_pid', new Set(['qb'])],
  ['nfl_games.home_qb_pid', new Set(['qb'])],
  ['nfl_plays_player.player_get_off', new Set(['off'])],
  ['nfl_team_gamelogs.defense_avg_get_off', new Set(['off'])],
  ['player_defender_gamelogs.pass_rush_get_off', new Set(['off'])],
  [
    'player_prospect_profile.positional_factor_off_man_coverage',
    new Set(['off'])
  ]
])

// External-id columns that end in _id but do not follow {system}_{entitytype}_id.
// Detected by pattern; this set is the known non-conforming roster for messaging.
const known_bad_external_ids = new Set([
  'gsisid',
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

// The ENTITY-TYPE vocabulary for the {system}_{entitytype}_id rule, derived from
// the schema's own table names rather than hand-listed.
//
// This closes the third and worst blind spot found in `conforms_external`. The
// two repaired in cc50e2a49 made a column INVISIBLE, so the count was a floor
// and everyone knew it; this one reported a non-conforming column as CLEAN,
// which means audit-zero could not be read as conformance. The mechanism was a
// bare two-token shape `/^[a-z0-9]+_[a-z0-9]+_id$/` that applied no vocabulary
// check to EITHER token, so any `qualifier_noun_id` conformed by construction
// regardless of whether the noun named an entity type at all. Found 2026-08-08
// on pff_player_seasonlogs.draft_franchise_id (21,489 of 34,613 rows
// populated), which read as system=`draft`, entity=`franchise` and passed --
// the audit reported four members of the franchise_id family where the schema
// had five.
//
// The other half of the same rule hand-listed five entity types
// (player|team|game|league|site), which is the enumeration trap the
// bare-shorthand rule above was inverted to escape: it reports only the
// vocabulary someone already thought of. Both halves are replaced by this one
// derivation, so a new entity type conforms on arrival with no edit here.
//
// A table name is the schema's own statement that a thing exists, so its tokens
// are the honest source. Deliberately NOT derived from the `_id` columns
// themselves -- that is circular, and would bless `franchise` on the strength of
// the very column this rule exists to flag.
//
// Every token is read, not just the last. A suffixed table name
// (`prop_markets_index`, `player_gamelogs`) ends on a bookkeeping word, so a
// last-token derivation both admits junk (`index`, `history`) and LOSES real
// types: `market`, `selection` and `drive` are entity types this schema stores
// and none of them is any table's final token. Measured on this schema, the
// last-token form turns 10 currently-conforming names red and the all-token
// form turns 4 red -- and `franchise` is absent from both, so the widening this
// task is aimed at survives the looser derivation intact.
// Tokens that appear in table names as this schema's own DOMAIN PREFIX rather
// than as a thing it stores. `nfl` is the whole list, and it is excluded for the
// identical reason `table_implies_vendor` below reads only
// `external_system_tokens`: `nfl` prefixes nfl_games / nfl_plays / nfl_snaps and
// names no entity anywhere. Admitting it lets `stad_nfl_id` read as
// system=`stad`, entity=`nfl` -- the same false conformance this derivation
// exists to close, one layer in. This can only ever make the rule STRICTER, so
// it is not the enumeration trap an accept-list would be; it is exactly one
// column on this schema.
const domain_prefix_tokens = new Set(['nfl'])

function derive_entity_type_vocabulary(tables) {
  const vocabulary = new Set()
  for (const table of tables.keys()) {
    for (const token of table.toLowerCase().split('_')) {
      if (domain_prefix_tokens.has(token)) continue
      vocabulary.add(token)
      vocabulary.add(singularize(token))
    }
  }
  return vocabulary
}

// Deliberately minimal -- it only has to reduce this schema's table names to the
// noun an id column would use. Every irregular case here is regular.
function singularize(token) {
  if (token.endsWith('ies')) return `${token.slice(0, -3)}y`
  if (/(s|x|z|ch|sh)es$/.test(token)) return token.slice(0, -2)
  if (token.endsWith('s') && !token.endsWith('ss')) return token.slice(0, -1)
  return token
}

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
  boolean_prefix: 'Boolean column not prefixed is_/has_',
  external_id: 'External-id column not following {system}_{entitytype}_id',
  timestamp_type: 'Non-timestamptz timestamp representation'
}

// Known instants whose NAME carries no time suffix, so the pattern below cannot
// see them. Keyed table.column. Both keeptradecut `d` columns lived here --
// integer epochs the suffix rule reported as clean because the name is a single
// letter -- until the valuations restructure retyped them to
// `observed_at timestamptz`, which the pattern recognises on its own.
//
// The entries below were found BY VALUE, not by name: db/tools/scan-epoch-columns.mjs
// read pg_stats histogram bounds against league_production and every one of them
// decodes through to_timestamp to a date between 2020 and 2026. Do not try to
// derive them from a naming pattern -- there is none, which is the whole reason
// the suffix rule reported them clean. Re-run that sweep to extend this set.
const known_time_columns = new Set([
  'nfl_plays.updated',
  // Not a partition child of nfl_plays -- an independent table carrying its own
  // copy of the column, which is why it needs its own entry.
  'nfl_plays_current_week.updated',
  'poaches.processed',
  'poaches.submitted',
  'restricted_free_agency_bids.cancelled',
  'restricted_free_agency_bids.processed',
  'restricted_free_agency_bids.submitted',
  'rosters.last_updated',
  'trades.accepted',
  'trades.cancelled',
  'trades.offered',
  'trades.rejected',
  // Added by hand rather than by the value sweep: 0 non-null of 303 rows, so
  // pg_stats had no histogram bound to decode. Same class as the four trades
  // columns above it.
  'trades.vetoed',
  'waivers.cancelled',
  'waivers.processed',
  'waivers.submitted'
])

function looks_like_time_column(table, name) {
  if (known_time_columns.has(`${table}.${name}`)) return true
  return /(_at|_time|_ts|timestamp|_date)$/.test(name) || name === 'timestamp'
}

function check_column(table, col, entity_type_vocabulary) {
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

  // Boolean predicate prefix. Computed before the shorthand block because it
  // CLAIMS the bare-short-name branch: a bare boolean like `spike` or `score` is
  // one defect with one remedy, and reporting it under both rules would inflate
  // the count and hand a worker two tickets for one rename.
  const unprefixed_boolean = is_unprefixed_boolean(col)
  if (unprefixed_boolean) {
    findings.push({ rule: 'boolean_prefix', table, column: col.name })
  }

  // Shorthand: the table-specific hint first, then the named-abbreviation map,
  // then the general bare-short-name rule for everything neither can name. The
  // first two branches survive on a boolean -- they carry a concrete full-word
  // replacement the boolean rule cannot supply -- but the bare-name branch does
  // not, per the reclassification above.
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
  } else if (
    !is_team_column &&
    !unprefixed_boolean &&
    is_bare_shorthand(lower)
  ) {
    findings.push({ rule: 'shorthand', table, column: col.name })
  } else if (lower.includes('_')) {
    // The INTERIOR-TOKEN half. Everything above judges the whole name -- the
    // table-specific hint, the abbreviation map and the bare-name rule all match
    // a name end to end -- so a column carrying its shorthand in an interior
    // token read CLEAN and the audit certified a bad name as good. That is the
    // same false-conformance class as `draft_franchise_id` and the permissive
    // two-token `external_id` shape, and the third time this program has found
    // one: `player_fuml_gsis`, `yds_gained`, `drive_yds_penalized` and
    // `deep_pass_att_percentage` all passed.
    //
    // Disjoint from the bare-name rule BY CONSTRUCTION rather than by care: that
    // branch returns false for any name containing an underscore and this one
    // requires one, so no column can be reported twice. The chain's earlier
    // branches take precedence for the same reason -- a name the abbreviation
    // map can NAME gets the map's concrete full-word hint, which is strictly
    // more useful than a token list.
    // Two ruled exemptions, neither expressible as a vocabulary entry: the
    // is_qb_* charting booleans are a SHAPE carve-out (ratifying `qb` would also
    // stop the gate flagging the format/settings position codes), and
    // `accepted_column_tokens` carries the per-column sense rulings, subtracted
    // token by token so a column's OTHER debt still reports.
    if (!is_qb_charting_boolean(col)) {
      const accepted = accepted_column_tokens.get(`${table}.${lower}`)
      const offending_tokens = nonconforming_tokens(lower).filter(
        (t) => !accepted || !accepted.has(t)
      )
      if (offending_tokens.length) {
        findings.push({
          rule: 'shorthand',
          table,
          column: col.name,
          token: offending_tokens.join(', ')
        })
      }
    }
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
  // fantasy_data) so gsis_it_player_id / fantasy_data_player_id conform, and
  // {entitytype} must be a token the schema's own table names use (see
  // derive_entity_type_vocabulary). Plus the {role}_pid form.
  //
  // At least two tokens before `_id` are required, so a bare `player_id` stays
  // an internal foreign key rather than an external-id claim -- the same
  // system-plus-entity shape the rule has always demanded.
  const conforms_external =
    conforms_qualified_external_id(lower, entity_type_vocabulary) ||
    /_pid$/.test(lower)
  if (
    (known_bad_external_ids.has(lower) ||
      (is_id_column &&
        !conforms_external &&
        looks_like_external(table, lower))) &&
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

// {system}_{entitytype}_id with a real entity type in the final noun position.
// Returns false for anything that is not lower snake_case ending in `_id`, for a
// single-token name, and for a noun the schema names no table after.
function conforms_qualified_external_id(name, entity_type_vocabulary) {
  if (!/^[a-z0-9]+(_[a-z0-9]+)+_id$/.test(name)) return false
  const tokens = name.slice(0, -'_id'.length).split('_')
  return entity_type_vocabulary.has(tokens[tokens.length - 1])
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

function looks_like_external(table, name) {
  if (external_vendor_tokens.some((t) => name_has_token(name, t))) return true
  // Glued form: vendor token running straight into the rest of the name, either
  // at the start (`espnid`) or after a separator (`home_ngsid`, `site_ngsid`).
  if (
    external_vendor_tokens.some((t) =>
      new RegExp(`(^|_)${t}[a-z0-9]`).test(name)
    )
  ) {
    return true
  }
  return table_implies_vendor(table, name)
}

// The vendor is named by the TABLE rather than by the column. `franchise_id` on
// pff_team_gamelogs is PFF's team identifier and carries no vendor token at all,
// so every vocabulary widening above is structurally unable to reach it -- and
// pff_team_gamelogs / pff_team_seasonlogs carry no other id column, so without
// this they produce no finding whatsoever and never appear in a flagged-list
// enumeration of the external-id class.
//
// Derived rather than enumerated, deliberately: a `table.column` set seeded with
// the four franchise_id columns would report exactly the debt someone already
// knew to type in, which is the enumeration trap the bare-shorthand rule above
// was inverted to escape. A new vendor table conforms on arrival with no edit.
//
// Two narrowings, both MEASURED against this schema rather than assumed, because
// the first draft of this rule took the audit from 39 findings to 86 and every
// one of the 28 false positives came from one of them.
//
// It reads `external_system_tokens`, NOT the full `external_vendor_tokens`
// vocabulary. Most of that list is unambiguously a third-party name, but `nfl`
// is simultaneously a vendor token and this schema's own domain prefix, so the
// full list matches `nfl_plays`, `nfl_snaps`, `nfl_coaches` and `nfl_play_stats`
// and flags every internal key on them -- `play_id`, `stat_id`, `coach_id`,
// `drive_start_play_id`. Those are internal app keys, and flagging them is the
// operation-log 004 failure that got the vendor-leak rule retired: a gate full
// of non-defects can never reach zero.
//
// And the column must end in a real `_id`. `is_id_column` above tests `/_?id$/`,
// which is deliberately loose so it reaches GLUED vendor ids (`gsisid`,
// `espnid`) -- but that also matches any name merely ENDING in those two
// letters, so `nfl_play_stats.is_valid` reported as an external id. The glued
// form always carries its vendor in the column name and so is reached by the
// vocabulary above; nothing needs it here.
function table_implies_vendor(table, name) {
  if (!/_id$/.test(name)) return false
  return external_system_tokens.some((t) => name_has_token(table, t))
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
// derived from the dump's ATTACH PARTITION lines by db/tools/schema-partitions.mjs;
// see that file for why the previous `<base>_year_YYYY` regex was wrong.

function audit(tables, partition_children, filter) {
  // Derived from the WHOLE schema, never from the filtered subset: scoping the
  // run to one table must not shrink the vocabulary its columns are judged
  // against, or `--table x` and the full run would disagree about x.
  const entity_type_vocabulary = derive_entity_type_vocabulary(tables)
  const all = []
  for (const [table, columns] of tables) {
    if (filter && table !== filter) continue
    if (!filter && partition_children.has(table)) continue
    all.push(...check_table_name(table))
    for (const col of columns) {
      all.push(...check_column(table, col, entity_type_vocabulary))
    }
  }
  return all
}

// An exemption entry that names a column the schema does not have would sit
// silent forever, so it fails the run rather than decaying into a stale
// exemption -- the same stale-adjudication backstop the consumer gates apply.
// An entry naming a token the column does not carry is stale in the same way,
// and is the shape a RENAME leaves behind: conforming the column's other tokens
// rewrites the key, so the old entry stops matching anything. Checking the token
// as well as the column is what makes the backstop survive this cluster, whose
// whole business is renaming the columns these entries name.
//
// An entry is checked when its TABLE is in scope. A schema declaring the table
// and not the column is making a claim the entry contradicts, which is the
// staleness worth failing on -- including the rehearsal path, where the
// candidate-schema recipe copies the candidate OVER the tracked path (the tool
// ignores LEAGUE_SCHEMA_FILE by design), so a rename that moves an exempted
// column fails the rehearsal rather than landing a key matching nothing. A
// schema that never mentions the table is a synthetic fixture or a partial
// candidate saying nothing either way, and holding it to the full exemption
// roster would couple every fixture to every future ruling.
function validate_column_token_exemptions(tables) {
  for (const [key, accepted] of accepted_column_tokens) {
    const dot = key.indexOf('.')
    const table = key.slice(0, dot)
    const column = key.slice(dot + 1)
    const columns = tables.get(table)
    if (!columns) continue
    if (!columns.some((c) => c.name === column)) {
      throw new Error(
        `stale conformance exemption ${key}: schema has no such column`
      )
    }
    const carried = new Set(nonconforming_tokens(column))
    for (const token of accepted) {
      if (!carried.has(token)) {
        throw new Error(
          `stale conformance exemption ${key}: column does not carry token '${token}'`
        )
      }
    }
  }
}

function main() {
  const argv = yargs(hideBin(process.argv))
    .option('table', { type: 'string', description: 'Audit one table only' })
    .option('summary', { type: 'boolean', default: false })
    .option('json', { type: 'boolean', default: false })
    // Reads the tracked db/schema.postgres.sql by default. The override exists
    // so a spec can point the real audit at a synthetic schema and assert what
    // it reports; note it is a FLAG rather than LEAGUE_SCHEMA_FILE, which
    // test/global.mjs honors and this tool deliberately does not -- a candidate
    // schema built for a migration must be copied over the tracked path, or the
    // reported numbers are the tracked ones and read like a no-op migration.
    .option('schema-file', {
      type: 'string',
      description: 'Audit a schema file other than db/schema.postgres.sql'
    })
    .help().argv

  const sql = fs.readFileSync(argv.schemaFile || schema_path, 'utf8')
  const tables = parse_schema(sql)
  const partition_children = parse_partition_children(sql)
  validate_column_token_exemptions(tables)
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
