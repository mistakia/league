/* global describe before after it */
import * as chai from 'chai'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { spawnSync } from 'child_process'
import { fileURLToPath } from 'url'

const expect = chai.expect
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const audit_script = path.join(
  __dirname,
  '..',
  'db',
  'tools',
  'audit-schema-conformance.mjs'
)

// The audit's shorthand rule judged the WHOLE NAME -- a table-specific hint, an
// abbreviation map, and a bare-name rule, each matching a name end to end -- so a
// column carrying its shorthand in an INTERIOR token read CLEAN and the audit
// certified a bad name as good. That is the same false-conformance class as
// `draft_franchise_id` and the permissive two-token `external_id` shape, and the
// third time this program has found one.
//
// It runs the real tool as a subprocess against a synthetic schema rather than
// importing the rule, so what it pins is the tool's reported OUTPUT and not an
// internal shape a refactor could move.
//
// Half of what the rule does is decide a token is NOT shorthand, and an
// over-eager vocabulary fails in the direction that looks like thoroughness --
// it would flag most of the schema and could never reach zero. So the clean
// cases are asserted as heavily as the flagged ones, and the whole set is pinned
// exactly at the foot of the file.
const synthetic_schema = `
CREATE TABLE public.nfl_plays (
    player_fuml_gsis character varying(36),
    yds_gained integer,
    drive_yds_penalized integer,
    no_score_prob numeric,
    bc_pid character varying(25),
    passing_yards integer,
    completion_percentage numeric,
    receiving_touchdowns integer,
    solo_tackle_1_pid character varying(25),
    -- The role-pid exemption set is validated against the audited schema, so the
    -- synthetic schema must carry the real exemption columns or the run fails on
    -- a "stale exemption" before it can report findings.
    qb_pid character varying(25)
);

CREATE TABLE public.nfl_games (
    nflverse_game_id character varying(36),
    field_goals_made_0_19_yards integer,
    away_qb_pid character varying(25),
    home_qb_pid character varying(25)
);

CREATE TABLE public.league_formats (
    cap integer,
    deep_pass_att_percentage numeric
);
`

const run_audit = (schema_file) => {
  const result = spawnSync(
    'node',
    [audit_script, '--json', '--schema-file', schema_file],
    { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }
  )
  // Exit 1 is the tool reporting violations, which is the expected state here.
  if (result.status !== 0 && result.status !== 1) {
    throw new Error(`audit exited ${result.status}: ${result.stderr}`)
  }
  return JSON.parse(result.stdout).findings
}

describe('schema conformance audit -- interior token shorthand', function () {
  let schema_file
  let shorthand_findings
  let shorthand_columns

  before(function () {
    schema_file = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), 'schema-conformance-')),
      'schema.postgres.sql'
    )
    fs.writeFileSync(schema_file, synthetic_schema)
    shorthand_findings = run_audit(schema_file).filter(
      (finding) => finding.rule === 'shorthand'
    )
    shorthand_columns = shorthand_findings.map(
      (finding) => `${finding.table}.${finding.column}`
    )
  })

  after(function () {
    fs.rmSync(path.dirname(schema_file), { recursive: true, force: true })
  })

  it('flags shorthand sitting in an interior token', function () {
    // `player_fuml_gsis` is the column the gap was found on, and it read CLEAN
    // under every whole-name branch: the map names `fuml` only as a bare column,
    // and the bare-name rule declines anything containing an underscore.
    expect(shorthand_columns).to.include('nfl_plays.player_fuml_gsis')
    expect(shorthand_columns).to.include('nfl_plays.yds_gained')
    expect(shorthand_columns).to.include('nfl_plays.drive_yds_penalized')
    expect(shorthand_columns).to.include(
      'league_formats.deep_pass_att_percentage'
    )
  })

  it('flags a token that is itself a dictionary word', function () {
    // The reason the oracle is a positive project vocabulary rather than a
    // dictionary: `prob`, `comp`, `rec`, `int` and `att` are all dictionary
    // words AND all shorthand the standard prohibits, so a dictionary-membership
    // rule is blind in exactly the direction that matters.
    expect(shorthand_columns).to.include('nfl_plays.no_score_prob')
  })

  it('names the offending tokens rather than only the column', function () {
    // A worker handed `player_fuml_gsis` with no token list has to re-derive
    // which half of the name is wrong -- and `gsis` is ratified, so the obvious
    // reading is the wrong one.
    const finding = shorthand_findings.find(
      (candidate) => candidate.column === 'player_fuml_gsis'
    )
    expect(finding.token).to.equal('fuml')
  })

  it('leaves a name built entirely from vocabulary clean', function () {
    expect(shorthand_columns).to.not.include('nfl_plays.passing_yards')
    expect(shorthand_columns).to.not.include('nfl_plays.completion_percentage')
    expect(shorthand_columns).to.not.include('nfl_plays.receiving_touchdowns')
  })

  it('leaves a ratified system name clean in token position', function () {
    // A vendor publishes its own name; expanding one would name the column
    // something the vendor's documentation does not use. Same reasoning that
    // exempted `epa` and `iqr` as bare names, applied to the token position.
    expect(shorthand_columns).to.not.include('nfl_games.nflverse_game_id')
  })

  it('leaves numeric tokens clean', function () {
    // A pure-digit token is a magnitude or an ordinal the surrounding words
    // already qualify, so it abbreviates nothing.
    expect(shorthand_columns).to.not.include(
      'nfl_games.field_goals_made_0_19_yards'
    )
    expect(shorthand_columns).to.not.include('nfl_plays.solo_tackle_1_pid')
  })

  it('reports a bare name once, under the bare-name rule', function () {
    // The two halves are disjoint BY CONSTRUCTION rather than by care: the
    // bare-name branch declines any name containing an underscore and the
    // interior-token branch requires one. `cap` is reported, and reported once.
    const cap_findings = shorthand_findings.filter(
      (finding) => finding.column === 'cap'
    )
    expect(cap_findings).to.have.lengthOf(1)
    expect(cap_findings[0].token).to.equal(undefined)
  })

  it('prefers the abbreviation map hint over a token list', function () {
    // A name the map can NAME gets a concrete full-word replacement, which is
    // strictly more useful to a worker than the tokens that failed lookup.
    const finding = shorthand_findings.find(
      (candidate) => candidate.column === 'bc_pid'
    )
    expect(finding.hint).to.equal('ball_carrier_pid')
    expect(finding.token).to.equal(undefined)
  })

  it('reports every flagged column and nothing else', function () {
    // Asserted as an exact set rather than as memberships: an over-eager
    // vocabulary that flagged the whole schema would satisfy every `include`
    // above, and over-permissiveness is what this class of failure is about, so
    // both directions have to be pinned at once.
    expect(shorthand_columns.sort()).to.deep.equal([
      'league_formats.cap',
      'league_formats.deep_pass_att_percentage',
      'nfl_plays.bc_pid',
      'nfl_plays.drive_yds_penalized',
      'nfl_plays.no_score_prob',
      'nfl_plays.player_fuml_gsis',
      'nfl_plays.yds_gained'
    ])
  })
})
