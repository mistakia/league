/* global describe it */

import * as chai from 'chai'

import db from '#db'
import { find_or_create_scoring_format } from '#libs-server/find-or-create-format.mjs'
import { canonicalize_bonuses } from '#libs-shared/scoring-columns.mjs'
import { scoring_formats } from '#libs-shared/league-format-definitions.mjs'

const expect = chai.expect

// Dedup of the `bonuses` rule list.
//
// league_scoring_formats dedups on config_digest, a generated md5 over every
// scoring column's ::text rendering. jsonb normalizes object key order and
// whitespace on store, so two equal rule OBJECTS already render identically --
// but jsonb PRESERVES array order, so [A, B] and [B, A] would digest
// differently and mint two format rows for one rule set, silently, with no
// error anywhere and nothing downstream able to tell them apart.
//
// canonicalize_bonuses runs in resolve_scoring_config, before the value is
// stored. It cannot run inside the digest expression: a generated column must
// be IMMUTABLE and cannot contain a set-returning function, which rules out
// jsonb_array_elements, and a user-defined IMMUTABLE function inside a
// generated column is a pg_dump/restore ordering hazard.
//
// This has to be DB-backed. The digest is computed by Postgres, so a pure-JS
// test of the canonicalizer proves the sort works and says nothing about
// whether two orderings actually land on one row.

// A real production config. Base columns with no registry default resolve to
// null when omitted -- deliberately, so a caller dropping one fails loudly --
// so a hand-built partial config cannot be inserted at all.
const base_config = scoring_formats.ppr.config

const RULES = [
  { type: 'big_play', stat: 'receiving_yards', threshold: 40, points: 10 },
  { type: 'milestone', stat: 'passing_yards', threshold: 300, points: 10 },
  { type: 'milestone', stat: 'rush_rec_yd', threshold: 100, points: 10 }
]

// Every assertion here is RELATIVE -- it compares ids that find_or_create
// returned in this same test -- so the spec needs no clean table and must not
// try to make one. An earlier draft truncated league_scoring_formats in a
// `before` hook; that passes alone and fails the full suite, because
// league_formats holds a foreign key onto rows other specs seeded.
describe('scoring format bonuses dedup', function () {
  it('canonicalizes rule order so two orderings dedup onto one format', async () => {
    const forward = await find_or_create_scoring_format(db, {
      ...base_config,
      bonuses: RULES
    })
    const reversed = await find_or_create_scoring_format(db, {
      ...base_config,
      bonuses: [...RULES].reverse()
    })

    expect(reversed).to.equal(forward)

    const rows = await db('league_scoring_formats').where('id', forward)
    expect(rows, 'exactly one row for the rule set').to.have.length(1)
  })

  it('stores the canonical order, not the authored order', async () => {
    const id = await find_or_create_scoring_format(db, {
      ...base_config,
      bonuses: [...RULES].reverse()
    })
    const row = await db('league_scoring_formats').where('id', id).first()

    expect(row.bonuses).to.eql(canonicalize_bonuses(RULES))
  })

  it('still distinguishes genuinely different rule sets', async () => {
    // The negative control. A canonicalizer that collapsed everything -- say by
    // sorting to a constant -- would pass the assertions above and be a far
    // worse bug than the one it fixes.
    const one = await find_or_create_scoring_format(db, {
      ...base_config,
      bonuses: RULES
    })
    const other = await find_or_create_scoring_format(db, {
      ...base_config,
      bonuses: [
        ...RULES,
        { type: 'milestone', stat: 'rush_rec_yd', threshold: 200, points: 10 }
      ]
    })

    expect(other).to.not.equal(one)
  })

  it('distinguishes a format with no rules from one with rules', async () => {
    const empty = await find_or_create_scoring_format(db, base_config)
    const with_rules = await find_or_create_scoring_format(db, {
      ...base_config,
      bonuses: RULES
    })

    expect(empty).to.not.equal(with_rules)

    // An omitted `bonuses` must resolve to the registry default and be
    // indistinguishable from an explicit empty list -- the digest coalesces
    // NULL to '', so a NULL here would digest as an empty array while behaving
    // differently.
    const explicit_empty = await find_or_create_scoring_format(db, {
      ...base_config,
      bonuses: []
    })
    expect(explicit_empty).to.equal(empty)
  })

  it('does not rewrite a rule to a different rule', async () => {
    // Canonicalization reorders and re-keys; it must not drop or alter a field.
    // Checked against the stored value rather than in memory, so a jsonb round
    // trip is part of the assertion.
    const id = await find_or_create_scoring_format(db, {
      ...base_config,
      bonuses: [
        { points: 10, threshold: 40, stat: 'receiving_yards', type: 'big_play' }
      ]
    })
    const row = await db('league_scoring_formats').where('id', id).first()

    expect(row.bonuses).to.eql([
      { type: 'big_play', stat: 'receiving_yards', threshold: 40, points: 10 }
    ])
  })
})
