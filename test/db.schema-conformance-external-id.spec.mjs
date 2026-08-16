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

// The audit's external-id rule certified bad names as good for as long as it
// carried a bare two-token shape `/^[a-z0-9]+_[a-z0-9]+_id$/`, which applied no
// vocabulary check to either token -- so any `qualifier_noun_id` conformed by
// construction. That is categorically worse than the two blind spots repaired in
// cc50e2a49: those made a column invisible, leaving the count an acknowledged
// floor, while this one reported a non-conforming column as CLEAN.
//
// The audit had been repaired once already with no regression test for the class
// it fixed, which is why this exists. It runs the real tool as a subprocess
// against a synthetic schema rather than importing the rule, so what it pins is
// the tool's reported OUTPUT and not an internal shape a refactor could move.
//
// The synthetic schema is deliberately small and self-contained: the tables in
// it are the entire source of the entity-type vocabulary the columns are then
// judged against, so each case states its own premise.
const synthetic_schema = `
CREATE TABLE public.player (
    pid character varying(25) NOT NULL,
    pff_player_id integer,
    gsis_it_player_id integer,
    sportradar_player_id character varying(36)
);

CREATE TABLE public.teams (
    team_id integer NOT NULL,
    draft_pff_team_id integer
);

CREATE TABLE public.pff_player_seasonlogs (
    pid character varying(25) NOT NULL,
    draft_franchise_id integer,
    pff_squad_id integer,
    pff_team_id integer
);

CREATE TABLE public.nfl_games (
    esbid character varying(36) NOT NULL,
    stad_nfl_id integer,
    away_qb_pid character varying(25),
    home_qb_pid character varying(25)
);

-- The audit validates the role-pid exemption set against the audited schema
-- (a stale entry fails the run), so the synthetic schema must carry every
-- exempted table.column or it dies on a "stale conformance exemption" before
-- it can report external-id findings.
CREATE TABLE public.nfl_plays (
    qb_pid character varying(25)
);
`

// A finding is reported once per (table, column, rule); the audit prints
// `[external_id] table.column` in its detail block and emits the same triple in
// --json, which is what the ratchet baseline keys on.
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

describe('schema conformance audit -- external id rule', function () {
  let schema_file
  let external_id_columns

  before(function () {
    schema_file = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), 'schema-conformance-')),
      'schema.postgres.sql'
    )
    fs.writeFileSync(schema_file, synthetic_schema)
    external_id_columns = run_audit(schema_file)
      .filter((finding) => finding.rule === 'external_id')
      .map((finding) => `${finding.table}.${finding.column}`)
  })

  after(function () {
    fs.rmSync(path.dirname(schema_file), { recursive: true, force: true })
  })

  it('flags a qualified vendor id whose entity token is not an entity type', function () {
    // The live instance the class was found on: read as system=`draft`,
    // entity=`franchise` and passed, though no table in the schema stores a
    // franchise. `pff_squad_id` is the same shape with a different qualifier,
    // and proves the flag is not keyed on the word `draft`.
    expect(external_id_columns).to.include(
      'pff_player_seasonlogs.draft_franchise_id'
    )
    expect(external_id_columns).to.include('pff_player_seasonlogs.pff_squad_id')
  })

  it("flags an id whose entity token is the schema's own domain prefix", function () {
    // `nfl` is a table-name token but names no entity, so admitting it would let
    // `stad_nfl_id` conform as system=`stad`, entity=`nfl`.
    expect(external_id_columns).to.include('nfl_games.stad_nfl_id')
  })

  it('leaves conforming vendor ids clean', function () {
    // The widening must not turn previously-correct names red. Each of these is
    // {system}_{entitytype}_id against a type the synthetic schema declares:
    // single-token system, multi-token system, and a qualified system.
    expect(external_id_columns).to.not.include('player.pff_player_id')
    expect(external_id_columns).to.not.include('player.gsis_it_player_id')
    expect(external_id_columns).to.not.include('player.sportradar_player_id')
    expect(external_id_columns).to.not.include('teams.draft_pff_team_id')
    expect(external_id_columns).to.not.include(
      'pff_player_seasonlogs.pff_team_id'
    )
  })

  it('reports every flagged column and nothing else', function () {
    // Asserted as an exact set rather than as memberships: an over-eager rule
    // that flagged the whole schema would satisfy every `include` above, and the
    // failure this class is about is the rule's PERMISSIVENESS, so both
    // directions have to be pinned at once.
    expect(external_id_columns.sort()).to.deep.equal([
      'nfl_games.stad_nfl_id',
      'pff_player_seasonlogs.draft_franchise_id',
      'pff_player_seasonlogs.pff_squad_id'
    ])
  })
})
