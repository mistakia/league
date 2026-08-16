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

// The 2026-08-15 operator rulings repaired three blind spots in the interior
// shorthand oracle before any schema move, so that audit-zero becomes a valid
// completion check for the conform campaign:
//
//   - `mid` was bootstrapped from the system dictionary, where it is a real
//     word, but it is shorthand on the DVOA team-unit tables (second_and_mid,
//     mid_zone, team_rush_mid_guard) -- a genuine gap, removed from the
//     vocabulary.
//   - A bare name over five characters was judged by no branch at all
//     (`is_bare_shorthand` returned early on length; the interior-token branch
//     requires an underscore), so glued app keys (`userid`, `tradeid`) and
//     compound shorthand were invisible.
//   - `is_qb_*` charting booleans and the role-pid columns were flagged on the
//     `qb` token even though the operator ruled both ratified -- the first by
//     SHAPE (a boolean named is_qb_<event>), the second by table.column.
//
// Like the interior-token and external-id specs, this runs the real tool as a
// subprocess against a synthetic schema so it pins reported OUTPUT rather than
// an internal shape a refactor could move.
const synthetic_schema = `
CREATE TABLE public.nfl_plays (
    qb_pid character varying(25),
    is_qb_pressure boolean,
    is_qb_hit boolean,
    starter_slots_qb integer,
    second_and_mid integer,
    player_esbid character varying(36),
    trade_uid integer,
    username character varying(60),
    userid integer
);

CREATE TABLE public.nfl_games (
    away_qb_pid character varying(25),
    home_qb_pid character varying(25),
    ball_carrier_pid character varying(25)
);

CREATE TABLE public.dvoa_team_unit_seasonlogs_history (
    second_and_mid_dvoa numeric,
    mid_zone_dvoa numeric
);

CREATE TABLE public.league_formats (
    is_qb_not_boolean integer,
    sourceid integer
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

describe('schema conformance audit -- 2026-08-15 oracle repair', function () {
  let schema_file
  let shorthand_columns
  let shorthand_tokens

  before(function () {
    schema_file = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), 'schema-conformance-')),
      'schema.postgres.sql'
    )
    fs.writeFileSync(schema_file, synthetic_schema)
    const findings = run_audit(schema_file).filter(
      (finding) => finding.rule === 'shorthand'
    )
    shorthand_columns = findings.map(
      (finding) => `${finding.table}.${finding.column}`
    )
    shorthand_tokens = new Map(
      findings.map((finding) => [
        `${finding.table}.${finding.column}`,
        finding.token
      ])
    )
  })

  after(function () {
    fs.rmSync(path.dirname(schema_file), { recursive: true, force: true })
  })

  it('flags `mid` as shorthand now that it is out of the vocabulary', function () {
    // `mid` was a dictionary word the bootstrap admitted, but it is the
    // ambiguity the globally-unique rule targets: medium distance-to-go, the
    // mid-zone blocking scheme and the interior gap all on one family of
    // tables. Removing it from the vocabulary surfaces the debt rather than
    // certifying three meanings under one token.
    expect(shorthand_columns).to.include('nfl_plays.second_and_mid')
    expect(shorthand_columns).to.include(
      'dvoa_team_unit_seasonlogs_history.second_and_mid_dvoa'
    )
    expect(shorthand_columns).to.include(
      'dvoa_team_unit_seasonlogs_history.mid_zone_dvoa'
    )
  })

  it('flags a long bare name that is not a vocabulary word', function () {
    // The five-character cap made every glued name unreachable. `userid` and
    // `sourceid` are app keys glued to `id`, none of them a word the schema may
    // spell a concept with.
    expect(shorthand_columns).to.include('nfl_plays.userid')
    expect(shorthand_columns).to.include('league_formats.sourceid')
  })

  it('leaves a long bare name that IS a vocabulary word clean', function () {
    // The widening must not turn legitimate compound words red: `username` is a
    // member of the domain vocabulary and stays clean, proving the long-bare
    // branch judges against the vocabulary rather than against length.
    expect(shorthand_columns).to.not.include('nfl_plays.username')
  })

  it('leaves is_qb_* charting booleans clean by shape', function () {
    // "QB hit" and "QB pressure" are the published charting stat names, which
    // is the closed-list test. The carve-out is the SHAPE (a boolean named
    // is_qb_<event>), not the token -- ratifying `qb` in the vocabulary would
    // also stop the gate flagging starter_slots_qb below.
    expect(shorthand_columns).to.not.include('nfl_plays.is_qb_pressure')
    expect(shorthand_columns).to.not.include('nfl_plays.is_qb_hit')
  })

  it('still flags `qb` where the is_qb_* shape does not apply', function () {
    // starter_slots_qb is a league-format/settings key, the class the plan most
    // wants the gate to hold; and a NON-boolean is_qb_* column fails the shape
    // (the is_ prefix promises boolean semantics) so its `qb` token still
    // reports.
    expect(shorthand_columns).to.include('nfl_plays.starter_slots_qb')
    expect(shorthand_tokens.get('nfl_plays.starter_slots_qb')).to.equal('qb')
    expect(shorthand_columns).to.include('league_formats.is_qb_not_boolean')
  })

  it('leaves the role-pid columns clean by table.column exemption', function () {
    // `{role}_pid` is the conformed role-reference pattern; `qb` there is the
    // role, not shorthand. Keyed table.column so the exemption cannot widen
    // silently.
    expect(shorthand_columns).to.not.include('nfl_plays.qb_pid')
    expect(shorthand_columns).to.not.include('nfl_games.away_qb_pid')
    expect(shorthand_columns).to.not.include('nfl_games.home_qb_pid')
  })

  it('leaves a non-exempt _pid column unaffected', function () {
    // The exemption must not move any OTHER _pid column's status. A conformed
    // role-pid name built from vocabulary stays clean; it is clean because it
    // is conformed, not because it is exempted.
    expect(shorthand_columns).to.not.include('nfl_games.ball_carrier_pid')
  })

  it('leaves ratified identifier tokens clean in token position', function () {
    // esbid and uid are allowlisted bare; the qualified `{entity}_{key}` form
    // is what the external-id rule asks for, so flagging the key in token
    // position would contradict a key the audit already certifies clean.
    expect(shorthand_columns).to.not.include('nfl_plays.player_esbid')
    expect(shorthand_columns).to.not.include('nfl_plays.trade_uid')
  })

  it('reports every flagged column and nothing else', function () {
    // Asserted as an exact set so the over-permissive direction is pinned too:
    // a vocabulary widened too far, or a carve-out that leaked, would satisfy
    // every `include` above while failing here.
    expect(shorthand_columns.sort()).to.deep.equal([
      'dvoa_team_unit_seasonlogs_history.mid_zone_dvoa',
      'dvoa_team_unit_seasonlogs_history.second_and_mid_dvoa',
      'league_formats.is_qb_not_boolean',
      'league_formats.sourceid',
      'nfl_plays.second_and_mid',
      'nfl_plays.starter_slots_qb',
      'nfl_plays.userid'
    ])
  })

  it('fails the run on a stale role-pid exemption entry', function () {
    // A schema missing one of the exempted columns must fail the run rather
    // than let the exemption sit inert -- the same stale-adjudication backstop
    // the consumer gates apply. Run against a schema that omits the role-pid
    // columns entirely.
    const minimal = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), 'schema-conformance-')),
      'schema.postgres.sql'
    )
    fs.writeFileSync(
      minimal,
      `CREATE TABLE public.nfl_plays ( play_id integer );\n`
    )
    try {
      const result = spawnSync(
        'node',
        [audit_script, '--json', '--schema-file', minimal],
        { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }
      )
      expect(result.stderr).to.include('stale conformance exemption')
    } finally {
      fs.rmSync(path.dirname(minimal), { recursive: true, force: true })
    }
  })
})
